// Pure advance-only marketplace pin policy + thin CLI wrapper.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function syncMarketplace(manifest, resolved) {
  const changes = [];
  const skips = [];
  const plugins = (manifest.plugins || []).map((p) => {
    const r = resolved[p.name];
    if (!r) return p; // no release resolved -> leave unchanged (workflow logs the warning)
    if (r.relation !== 'ahead') {
      skips.push({ name: p.name, reason: r.relation, fromSha: p.source?.sha, toSha: r.sha });
      return p;
    }
    const fromSha = p.source?.sha;
    // Overwriting existing keys preserves their original position (JS insertion order).
    const source = { ...p.source, ref: r.tag, sha: r.sha };
    changes.push({ name: p.name, fromSha, toSha: r.sha, ref: r.tag });
    return { ...p, source };
  });
  return { updated: { ...manifest, plugins }, changes, skips };
}

// CLI: node sync-marketplace.mjs <manifestPath> <resolvedJsonPath>
// Rewrites the manifest in place; prints { changes, skips } JSON to stdout.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [manifestPath, resolvedPath] = process.argv.slice(2);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const resolved = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const { updated, changes, skips } = syncMarketplace(manifest, resolved);
  fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ changes, skips }, null, 2) + '\n');
}
