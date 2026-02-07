#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { normalizeInput } = require('./lib/normalize');
const { solveGreedy } = require('./lib/solver');
const { validateSolution } = require('./lib/validate');

const parseArgs = (argv) => {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    i += 1;
  }
  return result;
};

const printUsage = () => {
  const lines = [
    'Usage:',
    '  node solver-lab/cli.js --in <input.json> --out <result.json> [--report <report.json>] [--seed 42] [--time 600]',
    '',
    'Input schema: ec-planning-input@2',
    'Output schema: ec-planning-result@1'
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
};

const readJson = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
};

const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    return;
  }

  if (!args.in || !args.out) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(process.cwd(), String(args.in));
  const outputPath = path.resolve(process.cwd(), String(args.out));
  const reportPath = args.report
    ? path.resolve(process.cwd(), String(args.report))
    : '';
  const seed = Number(args.seed || 42);
  const timeLimitSec = Number(args.time || 300);

  const startedAt = Date.now();
  const inputRaw = readJson(inputPath);
  const normalized = normalizeInput(inputRaw);
  const solved = solveGreedy(normalized, {
    seed: Number.isFinite(seed) ? seed : 42,
    timeLimitSec: Number.isFinite(timeLimitSec) ? timeLimitSec : 300
  });

  const audit = validateSolution(normalized, solved.assignments);
  const output = {
    schema: 'ec-planning-result@1',
    snapshot_id: `solver-${Date.now()}`,
    mode: 'replaceExisting',
    range: {
      startDate: normalized.scope.startDate,
      endDate: normalized.scope.endDate
    },
    rules: {
      timeSlots: normalized.slotKeys,
      slotWindows: normalized.slotWindows
    },
    assignments: solved.assignments,
    unassigned: [],
    meta: {
      solver: 'solver-lab-greedy@1',
      seed: Number.isFinite(seed) ? seed : 42,
      elapsedMs: Date.now() - startedAt
    }
  };

  writeJson(outputPath, output);

  const report = {
    summary: {
      groups: normalized.groups.length,
      locations: normalized.locations.length,
      assignmentsInput: normalized.existingAssignments.length,
      assignmentsOutput: solved.assignments.length,
      elapsedMs: Date.now() - startedAt
    },
    audit,
    diagnostics: solved.diagnostics
  };

  if (reportPath) {
    writeJson(reportPath, report);
  }

  process.stdout.write(`Wrote result: ${outputPath}\n`);
  process.stdout.write(
    `Hard violations: ${audit.hardViolations.length}, Must-visit missing: ${audit.mustVisitMissing.length}\n`
  );
  if (audit.hardViolations.length > 0 || audit.mustVisitMissing.length > 0) {
    process.exitCode = 2;
  }
};

main();

