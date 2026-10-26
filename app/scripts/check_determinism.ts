// Fails (exit 1) on non-deterministic APIs in engine/, transitions/ and scenes/first_light/.
// Comments and string/template literal text are ignored. Legit hits go in determinism_allowlist.json
// as { "file": "src/...", "token": "Date.now", "reason": "..." } (file is relative to app/, forward slashes).
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const ROOTS = ['src/engine', 'src/transitions', 'src/scenes/first_light'];
const BANNED: [string, RegExp][] = [
  ['Math.random', /\bMath\s*\.\s*random\b/g],
  ['Date.now', /\bDate\s*\.\s*now\b/g],
  ['performance.now', /\bperformance\s*\.\s*now\b/g],
  ['new Date(', /\bnew\s+Date\s*\(/g],
];

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|glsl)$/.test(e.name)) out.push(p);
  }
}

// Replaces comments and string contents with spaces, preserving line structure.
function stripNonCode(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      out += c; i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { out += ' '; i++; }
        if (c !== '`' && src[i] === '\n') break;
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      out += c; i++;
    } else { out += c; i++; }
  }
  return out;
}

const allow: { file: string; token: string; reason: string }[] = (() => {
  const f = path.join(import.meta.dir, 'determinism_allowlist.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
})();
const used = new Set<number>();

const files: string[] = [];
for (const r of ROOTS) {
  const d = path.join(APP, r);
  if (fs.existsSync(d)) walk(d, files);
  else console.log(`[determinism] skip (missing): ${r}`);
}

let violations = 0;
for (const f of files) {
  const rel = path.relative(APP, f).replace(/\\/g, '/');
  const lines = stripNonCode(fs.readFileSync(f, 'utf8')).split('\n');
  lines.forEach((line, idx) => {
    for (const [token, re] of BANNED) {
      re.lastIndex = 0;
      if (!re.test(line)) continue;
      const ai = allow.findIndex(a => a.file === rel && a.token === token);
      if (ai >= 0) { used.add(ai); continue; }
      violations++;
      console.error(`${rel}:${idx + 1}: ${token}`);
    }
  });
}
allow.forEach((a, i) => { if (!used.has(i)) console.warn(`[determinism] stale allowlist entry: ${a.file} ${a.token}`); });

console.log(`[determinism] scanned ${files.length} files, ${violations} violation(s), ${used.size} allowlisted`);
process.exit(violations ? 1 : 0);
