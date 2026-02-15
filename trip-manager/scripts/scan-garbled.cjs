/* eslint-disable no-console */
// Quick repo sanity scan: detect common "text got corrupted" symptoms that often lead to
// Vite/babel parse errors (unterminated strings) or ugly UI labels.
//
// Goal: lightweight, zero-deps, runnable via:
//   node scripts/scan-garbled.cjs

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const targets = [
  'frontend/src',
  'backend/src',
  'shared',
  'docs'
].map((p) => path.join(root, p));

const exts = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.cjs',
  '.mjs',
  '.css',
  '.md',
  '.json'
]);

const ignoreDirNames = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.cache',
  'coverage'
]);

/** @param {string} dir */
function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, onFile);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.has(ext)) continue;
    onFile(full);
  }
}

function findMatches(text) {
  /** @type {{kind: string, index: number}[]} */
  const matches = [];

  // U+FFFD replacement char: most common "decoder gave up" symptom.
  for (let idx = text.indexOf('\uFFFD'); idx !== -1; idx = text.indexOf('\uFFFD', idx + 1)) {
    matches.push({ kind: 'replacement_char', index: idx });
    if (matches.length >= 50) break;
  }

  // NUL bytes in a text file often indicate binary data or encoding corruption.
  for (let idx = text.indexOf('\u0000'); idx !== -1; idx = text.indexOf('\u0000', idx + 1)) {
    matches.push({ kind: 'nul_byte', index: idx });
    if (matches.length >= 50) break;
  }

  // Heuristic mojibake detection:
  // If a file contains many suspicious CJK symbols plus typical mojibake punctuation,
  // it is usually UTF-8/GBK decoding corruption.
  const suspiciousChars = /[鍍鍋鍑鍒鍓鍙鍚鍛鍜鍝鍥鍧鍩鍪鍭鍮鍯鎴鎵鎸鏂鏃鏉鏋鏍鏂闂闃闄锛銆鈥]/g;
  const punctuationHint = /[锛銆鈥]/;
  const hits = text.match(suspiciousChars) || [];
  if (hits.length >= 20 && punctuationHint.test(text)) {
    const idx = text.search(suspiciousChars);
    matches.push({ kind: 'mojibake_pattern', index: idx === -1 ? 0 : idx });
  }

  return matches;
}

function indexToLineCol(text, index) {
  const head = text.slice(0, index);
  const lines = head.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

/** @type {{file: string, issues: {kind: string, line: number, col: number}[]}[]} */
const findings = [];

for (const target of targets) {
  walk(target, (filePath) => {
    let text;
    try {
      // Read as bytes then decode as UTF-8; this is what Node/Vite expects in practice.
      const raw = fs.readFileSync(filePath);
      text = raw.toString('utf8');
    } catch (err) {
      findings.push({
        file: path.relative(root, filePath),
        issues: [{ kind: 'read_error', line: 1, col: 1 }]
      });
      return;
    }

    const matches = findMatches(text);
    if (matches.length === 0) return;

    const issues = matches.map((m) => {
      const pos = indexToLineCol(text, m.index);
      return { kind: m.kind, line: pos.line, col: pos.col };
    });

    findings.push({ file: path.relative(root, filePath), issues });
  });
}

if (findings.length === 0) {
  console.log('[scan-garbled] OK: no replacement chars / NUL bytes found.');
  process.exit(0);
}

console.log(`[scan-garbled] Found potential encoding issues in ${findings.length} file(s):`);
for (const f of findings) {
  const first = f.issues[0];
  const more = f.issues.length > 1 ? ` (+${f.issues.length - 1} more)` : '';
  console.log(`- ${f.file}:${first.line}:${first.col} ${first.kind}${more}`);
}

process.exit(1);
