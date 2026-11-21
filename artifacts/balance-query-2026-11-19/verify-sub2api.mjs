// Reproducible task evidence. Uses only project fixtures; no GUI or live RPC/API.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const artifact = dirname(fileURLToPath(import.meta.url)), root = resolve(artifact, '../..');
const output = join(artifact, 'verification-sub2api.json');
if (existsSync(output)) throw Error('Evidence already exists; choose a new file for another run');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const hostExecutable = process.env.DSH_TEST_EXECUTABLE;
if (!hostExecutable || !existsSync(hostExecutable) || !process.env.DSH_CHECKOUT) throw Error('Provide the verified existing Electron executable and DSH_CHECKOUT');
const steps = [
  { name: 'build', command: process.execPath, args: ['scripts/build.mjs'] },
  { name: 'local regression', command: process.execPath, args: pkg.scripts.test.split(/\s+/).slice(1) },
  { name: 'actual isolated SDK gateway (no live RPC)', command: hostExecutable, args: ['--expose-internals', '--loader', pathToFileURL(join(root, 'scripts/runtime-loader.mjs')).href, '--test', 'tests/host.test.mjs'] },
];
const results = [];
for (const step of steps) {
  const run = spawnSync(step.command, step.args, { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  results.push({ ...step, exitCode: run.status, stdout: run.stdout, stderr: run.stderr, error: run.error?.message });
  console.log(step.name + ': exit ' + run.status); console.log(run.stdout); if (run.stderr) console.error(run.stderr);
  if (run.status !== 0) break;
}
const baseline = JSON.parse(readFileSync(join(artifact, 'baseline-sub2api/snapshot.json'), 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
const changedBaselinePaths = Object.keys(baseline.hashes).filter(file => !existsSync(join(root, file)) || sha(file) !== baseline.hashes[file]);
const inspectPaths = [...Object.keys(baseline.hashes), ...['src', 'lib', 'tests'].flatMap(dir => readdirSync(join(root, dir)).filter(name => /\.(?:js|mjs)$/.test(name)).map(name => dir + '/' + name)), 'docs/balance-query-plan.md'];
const finalHashes = Object.fromEntries([...new Set(inspectPaths)].filter(file => existsSync(join(root, file))).map(file => [file, sha(file)]));
const complete = results.length === steps.length && results.every(result => result.exitCode === 0);
writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), node: process.version, packageVersion: pkg.version, complete, sourceSliceOnly: true,
  liveAPIRequested: false, realCredentialsRead: false, browserUsed: false, installedPluginChanged: false, deployed: false,
  previousReviewIssuesNotClosedByThisSlice: true, originalLocalBaseline: { passed: 89, failed: 0 },
  changedBaselinePaths, newPaths: Object.keys(finalHashes).filter(file => !(file in baseline.hashes)), finalHashes, results }, null, 2));
console.log('Evidence: ' + output);
if (!complete) process.exitCode = 1;
