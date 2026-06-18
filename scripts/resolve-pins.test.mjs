import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoOf } from './resolve-pins.mjs';

test('repoOf reads github shape', () => {
  assert.equal(repoOf({ source: 'github', repo: '7xuanlu/boule' }), '7xuanlu/boule');
});

test('repoOf derives owner/repo from git-subdir url', () => {
  assert.equal(repoOf({ source: 'git-subdir', url: 'https://github.com/7xuanlu/origin.git', path: 'plugin' }), '7xuanlu/origin');
});

test('repoOf returns null when unresolvable', () => {
  assert.equal(repoOf({ source: 'local' }), null);
});
