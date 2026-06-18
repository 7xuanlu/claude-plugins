import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncMarketplace } from './sync-marketplace.mjs';

const manifest = () => ({
  name: '7xuanlu',
  plugins: [
    { name: 'origin', source: { source: 'git-subdir', url: 'https://github.com/7xuanlu/origin.git', path: 'plugin', ref: 'main', sha: 'OLDORIGIN' }, description: 'd', category: 'memory' },
    { name: 'boule', source: { source: 'github', repo: '7xuanlu/boule', ref: 'main', sha: 'BOULESHA' }, description: 'd' },
    { name: 'ultrapowers', source: { source: 'github', repo: '7xuanlu/ultrapowers', ref: 'main', sha: 'OLDUP' }, description: 'd' },
  ],
});

test('advance: github shape updates ref+sha', () => {
  const { updated, changes } = syncMarketplace(manifest(), { ultrapowers: { tag: 'v0.2.0', sha: 'NEWUP', relation: 'ahead' } });
  const up = updated.plugins.find((p) => p.name === 'ultrapowers');
  assert.equal(up.source.sha, 'NEWUP');
  assert.equal(up.source.ref, 'v0.2.0');
  assert.deepEqual(changes, [{ name: 'ultrapowers', fromSha: 'OLDUP', toSha: 'NEWUP', ref: 'v0.2.0' }]);
});

test('advance: git-subdir shape updates ref+sha, preserves path', () => {
  const { updated } = syncMarketplace(manifest(), { origin: { tag: 'v0.9.0', sha: 'NEWORIGIN', relation: 'ahead' } });
  const o = updated.plugins.find((p) => p.name === 'origin');
  assert.equal(o.source.sha, 'NEWORIGIN');
  assert.equal(o.source.ref, 'v0.9.0');
  assert.equal(o.source.path, 'plugin');
  assert.equal(o.source.source, 'git-subdir');
});

test('no-downgrade: behind relation does not change pin', () => {
  const { updated, changes, skips } = syncMarketplace(manifest(), { origin: { tag: 'v0.8.4', sha: 'TAGCOMMIT', relation: 'behind' } });
  assert.equal(updated.plugins.find((p) => p.name === 'origin').source.sha, 'OLDORIGIN');
  assert.equal(changes.length, 0);
  assert.equal(skips[0].reason, 'behind');
});

test('identical relation is a no-op skip', () => {
  const { changes, skips } = syncMarketplace(manifest(), { boule: { tag: 'v0.1.0', sha: 'BOULESHA', relation: 'identical' } });
  assert.equal(changes.length, 0);
  assert.equal(skips[0].reason, 'identical');
});

test('diverged relation does not change pin', () => {
  const { changes, skips } = syncMarketplace(manifest(), { ultrapowers: { tag: 'vX', sha: 'WEIRD', relation: 'diverged' } });
  assert.equal(changes.length, 0);
  assert.equal(skips[0].reason, 'diverged');
});

test('plugin missing from map is untouched', () => {
  const { updated, changes, skips } = syncMarketplace(manifest(), {});
  assert.equal(changes.length, 0);
  assert.equal(skips.length, 0);
  assert.equal(updated.plugins.find((p) => p.name === 'boule').source.sha, 'BOULESHA');
});

test('mixed relations in one pass', () => {
  const { changes, skips } = syncMarketplace(manifest(), {
    ultrapowers: { tag: 'v0.2.0', sha: 'NEWUP', relation: 'ahead' },
    origin: { tag: 'v0.8.4', sha: 'TC', relation: 'behind' },
    boule: { tag: 'v0.1.0', sha: 'BOULESHA', relation: 'identical' },
  });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].name, 'ultrapowers');
  assert.equal(skips.length, 2);
});

test('key order preserved in github source', () => {
  const { updated } = syncMarketplace(manifest(), { boule: { tag: 'v0.2.0', sha: 'NB', relation: 'ahead' } });
  assert.deepEqual(Object.keys(updated.plugins.find((p) => p.name === 'boule').source), ['source', 'repo', 'ref', 'sha']);
});
