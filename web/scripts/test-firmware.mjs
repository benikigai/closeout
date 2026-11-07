import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const source = JSON.parse(readFileSync('demo-source/provenance.json', 'utf8'));
for (const [file, hash] of Object.entries(source.files_sha256)) {
  assert.equal(createHash('sha256').update(readFileSync(path.join('demo-source', file))).digest('hex'), hash);
}
function run(revision, ready, defect) {
  return JSON.parse(execFileSync(path.resolve('demo-bin', revision), [String(ready), String(defect)], { encoding: 'utf8', timeout: 3000 }));
}
for (const ready of [20, 50, 51, 180]) {
  assert.equal(run('before', ready, 0).result, ready <= 50 ? 'pass' : 'fail');
  assert.equal(run('fixed', ready, 0).result, 'pass');
  assert.equal(run('before', ready, 1).result, 'fail');
  assert.equal(run('fixed', ready, 1).result, 'fail');
}
assert.deepEqual(run('before', 180, 0), run('before', 180, 0));
assert.equal(run('fixed', 180, 1).uniformity, .22);
console.log('PASS: source digests, timing boundary, cold repair, physical controls, repeatability.');
