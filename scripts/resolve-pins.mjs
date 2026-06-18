// Resolve each marketplace plugin to its source repo's latest published release
// commit + relation vs the current pin. Network code (GitHub REST, global fetch).
// The pure policy lives in sync-marketplace.mjs; only repoOf is unit-tested here.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function repoOf(source = {}) {
  if (source.repo) return source.repo;
  if (source.url) return source.url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  return null;
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
async function api(path) {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'claude-plugins-sync',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const resolved = {};
  for (const p of manifest.plugins || []) {
    const repo = repoOf(p.source || {});
    const curSha = p.source?.sha;
    if (!repo) { console.error(`::warning::no source repo for ${p.name}`); continue; }

    const relRes = await api(`/repos/${repo}/releases/latest`);
    if (relRes.status === 404) { console.error(`::warning::no published release for ${p.name} (${repo}) — skipping`); continue; }
    if (!relRes.ok) throw new Error(`releases/latest ${repo}: ${relRes.status}`);
    const tag = (await relRes.json()).tag_name;

    const refRes = await api(`/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
    if (!refRes.ok) throw new Error(`git/ref/tags ${repo} ${tag}: ${refRes.status}`);
    const obj = (await refRes.json()).object;
    let sha = obj.sha;
    if (obj.type === 'tag') { // annotated tag -> dereference to commit
      const tRes = await api(`/repos/${repo}/git/tags/${sha}`);
      if (!tRes.ok) throw new Error(`git/tags ${repo} ${sha}: ${tRes.status}`);
      sha = (await tRes.json()).object.sha;
    }

    let relation = 'unknown';
    if (curSha) {
      const cRes = await api(`/repos/${repo}/compare/${curSha}...${sha}`);
      if (cRes.ok) relation = (await cRes.json()).status; // ahead|behind|identical|diverged
      else if (cRes.status !== 404) throw new Error(`compare ${repo}: ${cRes.status}`);
    }
    resolved[p.name] = { tag, sha, relation };
    console.error(`resolved ${p.name}: ${tag} ${sha.slice(0, 7)} (${relation})`);
  }
  process.stdout.write(JSON.stringify(resolved, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
