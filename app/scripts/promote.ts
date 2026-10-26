#!/usr/bin/env bun
// ==============================================================================
// f(x) Studio: Automated Release Promotion Script (nightly -> main)
// Promotes verified code from nightly to main, excluding dev-only test scripts,
// internal prompts, and deploying the clean consumer README.
//
// Usage:
//   bun scripts/promote.ts [--skip-tests] [--no-tag] [--push] [--dry-run]
// ==============================================================================

import path from 'node:path';
import { existsSync, rmSync, readdirSync, copyFileSync } from 'node:fs';

const SCRIPT_DIR = import.meta.dir;
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..');

const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const noTag = args.includes('--no-tag');
const pushRemote = args.includes('--push');
const dryRun = args.includes('--dry-run');

function run(cmd: string[], cwd: string = ROOT_DIR): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout ? new TextDecoder().decode(proc.stdout).trim() : '',
    stderr: proc.stderr ? new TextDecoder().decode(proc.stderr).trim() : '',
  };
}

function execOrThrow(cmd: string[], desc: string, cwd: string = ROOT_DIR) {
  console.log(`[promote] ${desc}...`);
  const r = run(cmd, cwd);
  if (r.exitCode !== 0) {
    console.error(`\n❌ Error: ${desc} failed (exit code ${r.exitCode})`);
    if (r.stderr) console.error(r.stderr);
    if (r.stdout) console.log(r.stdout);
    process.exit(1);
  }
  return r.stdout;
}

console.log('\n===============================================================');
console.log(' f(x) STUDIO: RELEASE PROMOTION PIPELINE (nightly -> main)');
console.log('===============================================================\n');

// 1. Check git status
const branch = execOrThrow(['git', 'branch', '--show-current'], 'Checking current branch');
if (branch !== 'nightly') {
  console.error(`❌ Must be on 'nightly' branch to promote. Current branch: '${branch}'`);
  process.exit(1);
}

const status = execOrThrow(['git', 'status', '--porcelain'], 'Checking git status');
if (status.length > 0) {
  console.error('❌ Working directory is dirty. Please commit or stash changes before promoting.');
  console.error(status);
  process.exit(1);
}

// 2. Read version
const pkgPath = path.join(APP_DIR, 'package.json');
const pkg = JSON.parse(await Bun.file(pkgPath).text());
const version = pkg.version || '0.7.0';
console.log(`[promote] Target release version: v${version}`);

// 3. Verification Gate
if (!skipTests) {
  console.log('\n--- 1. Verification Gate ---');
  execOrThrow([process.execPath, 'run', 'check:determinism'], 'Running determinism scan', APP_DIR);
  execOrThrow([process.execPath, 'run', 'typecheck'], 'Running TypeScript typecheck', APP_DIR);
  execOrThrow([process.execPath, 'scripts/check_seams.ts'], 'Checking transition seams', APP_DIR);
  execOrThrow([process.execPath, 'scripts/test_mixdown.ts'], 'Verifying audio compliance', APP_DIR);
  console.log('✓ All verification tests passed!\n');
} else {
  console.log('⚠️ Skipping tests (--skip-tests flag passed).\n');
}

if (dryRun) {
  console.log('🔍 DRY RUN completed successfully. No changes made to main.');
  process.exit(0);
}

// 4. Switch to main
console.log('--- 2. Syncing to main ---');
execOrThrow(['git', 'checkout', 'main'], 'Switching to main branch');
execOrThrow(['git', 'checkout', 'nightly', '--', '.'], 'Syncing all files from nightly');

// 5. Strip dev-only files on main
console.log('--- 3. Pruning dev-only test harnesses & internal files ---');
const filesToPrune = [
  // Dev & benchmark test scripts
  'app/scripts/check_scrub_determinism.ts',
  'app/scripts/smoke_memory.ts',
  'app/scripts/_glyph_hash.ts',
  'app/scripts/inspect_frame.ts',
  'app/scripts/raster_glyphs.ts',
  'app/scripts/gen_hershey_glyphs.ts',
  'app/scripts/queries',
  'app/src/scenes/_prereq_demos',
  'prompts',
  'prompt.md',
  'scripts/test_analyze_song.py',
  'README.nightly.md',
];

// Add all test_*.ts and time_*.ts in app/scripts
const scriptsDir = path.join(APP_DIR, 'scripts');
if (existsSync(scriptsDir)) {
  for (const file of readdirSync(scriptsDir)) {
    if (file.startsWith('test_') || file.startsWith('time_')) {
      filesToPrune.push(path.join('app', 'scripts', file));
    }
  }
}

for (const relPath of filesToPrune) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`  - Removed ${relPath}`);
  }
}

// 6. Deploy README.main.md as root README.md
const readmeMainPath = path.join(ROOT_DIR, 'README.main.md');
const readmeRootPath = path.join(ROOT_DIR, 'README.md');
if (existsSync(readmeMainPath)) {
  copyFileSync(readmeMainPath, readmeRootPath);
  rmSync(readmeMainPath, { force: true });
  console.log('  ✓ Deployed consumer README.md to root of main');
}

// 7. Update app/package.json on main (prune deleted script commands)
const mainPkgPath = path.join(APP_DIR, 'package.json');
if (existsSync(mainPkgPath)) {
  const mainPkg = JSON.parse(await Bun.file(mainPkgPath).text());
  const cleanScripts: Record<string, string> = {
    dev: mainPkg.scripts?.dev || 'vite',
    build: mainPkg.scripts?.build || 'vite build',
    typecheck: 'tsc --noEmit',
    test: 'bun scripts/test_milestones.ts',
    'test:seams': 'bun scripts/check_seams.ts',
    'check:determinism': 'bun scripts/check_determinism.ts',
  };
  mainPkg.scripts = cleanScripts;
  await Bun.write(mainPkgPath, JSON.stringify(mainPkg, null, 2) + '\n');
  console.log('  ✓ Cleaned script matrix in app/package.json on main');
}

// 8. Commit on main
console.log('--- 4. Committing Release on main ---');
execOrThrow(['git', 'add', '-A'], 'Staging all changes on main');
execOrThrow(['git', 'commit', '-m', `release(v${version}): production release v${version}`], 'Committing release');

// 9. Tag if enabled
const tag = `v${version}`;
if (!noTag) {
  const existingTags = run(['git', 'tag', '-l', tag]).stdout;
  if (existingTags === tag) {
    execOrThrow(['git', 'tag', '-d', tag], `Removing old local tag ${tag}`);
  }
  execOrThrow(['git', 'tag', '-a', tag, '-m', `Release ${tag}`], `Tagging release as ${tag}`);
  console.log(`  ✓ Created tag ${tag}`);
}

// 10. Optional Push
if (pushRemote) {
  console.log('--- 5. Pushing to origin ---');
  execOrThrow(['git', 'push', 'origin', 'main'], 'Pushing main to origin');
  if (!noTag) {
    execOrThrow(['git', 'push', 'origin', tag, '--force'], `Pushing tag ${tag} to origin`);
  }
}

// 11. Switch back to nightly
console.log('--- 6. Returning to nightly ---');
execOrThrow(['git', 'checkout', 'nightly'], 'Switching back to nightly');

// Ensure README.md on nightly is kept in sync with README.nightly.md
const readmeNightlyPath = path.join(ROOT_DIR, 'README.nightly.md');
if (existsSync(readmeNightlyPath)) {
  copyFileSync(readmeNightlyPath, readmeRootPath);
}

console.log('\n===============================================================');
console.log(` 🎉 Successfully promoted v${version} to main!`);
console.log(' You are now back on the nightly branch.');
if (!pushRemote) {
  console.log(' (Note: Changes committed locally to main. Run with --push or push manually when ready.)');
}
console.log('===============================================================\n');
