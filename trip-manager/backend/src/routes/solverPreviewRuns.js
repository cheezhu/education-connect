const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const { buildPlanningInputPayload, PlanningInputBuildError } = require('../utils/buildPlanningInputPayload');

const router = express.Router();

const PYTHON_BIN = '/opt/solver-venv/bin/python';
const SOLVER_CLI = '/app/solver-lab-py/cli.py';

const DEFAULT_TIME_LIMIT_SEC = 600;
const MIN_TIME_LIMIT_SEC = 600;
const MAX_TIME_LIMIT_SEC = 1800;

const LOG_TAIL_MAX_BYTES = 64 * 1024;
const MAX_RUNS_TO_KEEP = 200;

const parseJsonSafe = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizeTimeLimitSec = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_TIME_LIMIT_SEC;
  }
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIME_LIMIT_SEC;
  }
  return Math.max(MIN_TIME_LIMIT_SEC, Math.min(MAX_TIME_LIMIT_SEC, parsed));
};

const pruneOldRuns = (db) => {
  db.exec(`
    DELETE FROM solver_preview_runs
    WHERE id NOT IN (
      SELECT id FROM solver_preview_runs
      ORDER BY created_at DESC
      LIMIT ${MAX_RUNS_TO_KEEP}
    )
  `);
};

const buildCandidatesSummary = (candidatesPayload) => {
  if (!candidatesPayload || typeof candidatesPayload !== 'object') return null;
  const candidates = Array.isArray(candidatesPayload.candidates) ? candidatesPayload.candidates : [];
  return {
    schema: String(candidatesPayload.schema || ''),
    primaryProfileId: candidatesPayload.primaryProfileId || null,
    candidates: candidates.map((row) => ({
      profile: row?.profile || null,
      metrics: row?.metrics || null,
      config: row?.config || null
    }))
  };
};

// In-memory queue worker (concurrency = 1, per backend process).
const runQueue = [];
let workerRunning = false;
let workerDb = null;

const triggerWorker = () => {
  if (workerRunning) return;
  if (!workerDb) return;
  workerRunning = true;
  setImmediate(async () => {
    try {
      while (runQueue.length > 0) {
        const runId = runQueue.shift();
        await processRun(workerDb, runId);
      }
    } finally {
      workerRunning = false;
      // If new work arrived while we were flipping the flag, re-trigger.
      if (runQueue.length > 0) {
        triggerWorker();
      }
    }
  });
};

const enqueueRun = (db, runId) => {
  workerDb = workerDb || db;
  runQueue.push(runId);
  triggerWorker();
};

const updateRun = (db, runId, fields) => {
  const entries = Object.entries(fields || {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const setters = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  db.prepare(`UPDATE solver_preview_runs SET ${setters} WHERE id = ?`).run(...values, runId);
};

const processRun = async (db, runId) => {
  const row = db.prepare('SELECT * FROM solver_preview_runs WHERE id = ?').get(runId);
  if (!row) return;
  if (row.status !== 'queued') {
    return;
  }

  updateRun(db, runId, {
    status: 'running',
    started_at: new Date().toISOString(),
    finished_at: null,
    error: null
  });

  const request = parseJsonSafe(row.request_json, {}) || {};
  const timeLimitSec = normalizeTimeLimitSec(request.timeLimitSec);

  let inputPayload = null;
  let logTailBuf = Buffer.alloc(0);

  try {
    const { payload } = buildPlanningInputPayload(db, {
      groupIds: request.groupIds,
      startDate: request.startDate,
      endDate: request.endDate,
      // Preview runs are isolated from current designer data by default.
      includeExistingActivities: false,
      includeExistingSchedules: false,
      includePlanItemsByGroup: true
    });
    inputPayload = payload;

    updateRun(db, runId, {
      input_json: JSON.stringify(inputPayload)
    });

    const tmpDir = path.join(os.tmpdir(), `solver-preview-${runId}`);
    const inputPath = path.join(tmpDir, 'input.json');
    const outPath = path.join(tmpDir, 'result.json');
    const reportPath = path.join(tmpDir, 'report.json');
    const candidatesPath = path.join(tmpDir, 'candidates.json');

    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(inputPath, JSON.stringify(inputPayload, null, 2), 'utf8');

    const args = [
      SOLVER_CLI,
      '--in', inputPath,
      '--out', outPath,
      '--report', reportPath,
      '--candidates', candidatesPath,
      '--multi',
      '--candidates-max', '6',
      '--seed', '42',
      '--time', String(timeLimitSec),
      '--workers', '8'
    ];

    const proc = spawn(PYTHON_BIN, args, {
      cwd: tmpDir,
      env: process.env
    });

    const appendLogTail = (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      logTailBuf = Buffer.concat([logTailBuf, buf]);
      if (logTailBuf.length > LOG_TAIL_MAX_BYTES) {
        logTailBuf = logTailBuf.subarray(logTailBuf.length - LOG_TAIL_MAX_BYTES);
      }
    };

    proc.stdout.on('data', appendLogTail);
    proc.stderr.on('data', appendLogTail);

    const hardTimeoutMs = (timeLimitSec + 30) * 1000;
    const timeout = setTimeout(() => {
      appendLogTail(`\n[runner] timeout after ${hardTimeoutMs}ms, killing process\n`);
      proc.kill('SIGKILL');
    }, hardTimeoutMs);

    const exit = await new Promise((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code, signal) => resolve({ code, signal }));
    });

    clearTimeout(timeout);

    const candidatesText = await fs.readFile(candidatesPath, 'utf8').catch(() => null);
    const reportText = await fs.readFile(reportPath, 'utf8').catch(() => null);
    const candidatesJson = candidatesText ? parseJsonSafe(candidatesText, null) : null;
    const reportJson = reportText ? parseJsonSafe(reportText, null) : null;

    updateRun(db, runId, {
      candidates_json: candidatesJson ? JSON.stringify(candidatesJson) : null,
      report_json: reportJson ? JSON.stringify(reportJson) : null,
      log_tail: logTailBuf.toString('utf8')
    });

    const exitOk = exit.code === 0;
    const producedCandidates = Boolean(candidatesJson && typeof candidatesJson === 'object');
    const producedReport = Boolean(reportJson && typeof reportJson === 'object');

    if (!exitOk) {
      updateRun(db, runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: `Solver exited with code=${exit.code}${exit.signal ? ` signal=${exit.signal}` : ''}`
      });
    } else if (!producedCandidates || !producedReport) {
      updateRun(db, runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: 'Solver finished but candidates/report missing'
      });
    } else {
      updateRun(db, runId, {
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        error: null
      });
    }

    pruneOldRuns(db);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  } catch (error) {
    const logTail = logTailBuf.length ? logTailBuf.toString('utf8') : null;
    let errorText = 'Unknown error';
    let status = 'failed';

    if (error instanceof PlanningInputBuildError) {
      errorText = JSON.stringify(error.body || { error: error.message });
    } else if (error && typeof error === 'object' && error.message) {
      errorText = String(error.message);
    } else {
      errorText = String(error);
    }

    updateRun(db, runId, {
      status,
      finished_at: new Date().toISOString(),
      error: errorText,
      log_tail: logTail
    });

    pruneOldRuns(db);
  }
};

router.post('/', (req, res) => {
  const body = req.body || {};
  const groupIds = Array.isArray(body.groupIds)
    ? body.groupIds.map(id => Number(id)).filter(Number.isFinite)
    : [];
  const startDate = typeof body.startDate === 'string' ? body.startDate : null;
  const endDate = typeof body.endDate === 'string' ? body.endDate : null;
  const timeLimitSec = normalizeTimeLimitSec(body.timeLimitSec);

  const runId = crypto.randomUUID();
  const createdBy = req.user || null;
  const requestJson = JSON.stringify({
    groupIds,
    startDate,
    endDate,
    timeLimitSec
  });

  req.db.prepare(`
    INSERT INTO solver_preview_runs (id, status, created_by, request_json)
    VALUES (?, ?, ?, ?)
  `).run(runId, 'queued', createdBy, requestJson);

  pruneOldRuns(req.db);

  enqueueRun(req.db, runId);

  res.json({ runId });
});

router.get('/', (req, res) => {
  const limitRaw = req.query.limit;
  const limit = Math.max(1, Math.min(MAX_RUNS_TO_KEEP, Math.floor(Number(limitRaw || MAX_RUNS_TO_KEEP))));

  const rows = req.db.prepare(`
    SELECT id, status, created_at, started_at, finished_at, created_by, request_json, error
    FROM solver_preview_runs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  const data = rows.map((row) => {
    const request = parseJsonSafe(row.request_json, null);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdBy: row.created_by,
      request,
      error: row.error || null
    };
  });

  res.json({ runs: data });
});

router.get('/:runId', (req, res) => {
  const runId = req.params.runId;
  const row = req.db.prepare(`
    SELECT id, status, created_at, started_at, finished_at, created_by, request_json, error, log_tail, candidates_json
    FROM solver_preview_runs
    WHERE id = ?
  `).get(runId);

  if (!row) {
    return res.status(404).json({ error: 'Run not found' });
  }

  const candidatesPayload = parseJsonSafe(row.candidates_json, null);
  const summary = buildCandidatesSummary(candidatesPayload);

  res.json({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdBy: row.created_by,
    request: parseJsonSafe(row.request_json, null),
    error: row.error || null,
    logTail: row.log_tail || null,
    candidatesSummary: summary
  });
});

router.get('/:runId/candidates', (req, res) => {
  const runId = req.params.runId;
  const row = req.db.prepare(`
    SELECT id, status, input_json, candidates_json, report_json
    FROM solver_preview_runs
    WHERE id = ?
  `).get(runId);

  if (!row) {
    return res.status(404).json({ error: 'Run not found' });
  }

  const input = parseJsonSafe(row.input_json, null);
  const candidates = parseJsonSafe(row.candidates_json, null);
  const report = parseJsonSafe(row.report_json, null);

  res.json({
    id: row.id,
    status: row.status,
    input,
    candidates,
    report
  });
});

module.exports = router;

