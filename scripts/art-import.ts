/**
 * npm run art:import -- --from <dir|zip> --id <id> [--gen <name>]
 *
 * Copies a PixelLab export into art-src/pixellab/<id>/<gen>/raw, writes gen.json,
 * normalises direction folder names on a sidecar map (raw files stay untouched),
 * and upserts a candidate registry entry.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { ArtAsset, ArtRegistry } from '../src/art/registry.types';
import { HASH_SUFFIX, kebab, toShortDir } from './art-dirs';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function main() {
  const repo = path.resolve(__dirname, '..');
  const from = arg('from');
  const id = arg('id');
  if (!from || !id) throw new Error('Usage: art:import -- --from <dir> --id <id> [--gen <name>]');
  const src = path.resolve(from);
  if (!fs.existsSync(src)) throw new Error(`no such path: ${src}`);
  const gen = arg('gen') ?? `gen-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}-1`;
  const dest = path.join(repo, 'art-src/pixellab', id, gen, 'raw');
  fs.rmSync(dest, { recursive: true, force: true });
  if (src.toLowerCase().endsWith('.zip')) {
    throw new Error('zip import: unzip first, then --from the extracted folder');
  }
  copyDir(src, dest);

  const dirMap: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const short = toShortDir(entry.name.replace(HASH_SUFFIX, ''));
        if (short !== entry.name) dirMap[path.relative(dest, full)] = short;
        walk(full);
      }
    }
  };
  walk(dest);

  const genJson = {
    tool: 'pixellab',
    model: arg('model') ?? null,
    prompt: arg('prompt') ?? null,
    negative: arg('negative') ?? null,
    seed: arg('seed') ?? null,
    size: arg('size') ?? null,
    view: 'low top-down',
    direction: null,
    palette: 'streetwear-v4',
    referenceImageIds: [],
    params: {},
    cost: null,
    createdAt: new Date().toISOString(),
    operator: process.env.CURSOR_AGENT_ID ?? 'agent',
    picked: true,
    critique: { score: null, notes: '' },
    dirMap,
  };
  fs.writeFileSync(path.join(repo, 'art-src/pixellab', id, gen, 'gen.json'), `${JSON.stringify(genJson, null, 2)}\n`);

  const registryPath = path.join(repo, 'assets/art/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ArtRegistry;
  const existing = registry.assets.find((a) => a.id === id);
  const stub: ArtAsset = existing ?? {
    id,
    path: `assets/art/_unpacked/${kebab(id)}.png`,
    type: 'character',
    theme: 'streetwear',
    placement: 'floor',
    camera: 'td-3q-low',
    size: { w: 0, h: 0 },
    status: 'candidate',
    source: 'pixellab',
    sourceRef: `art-src/pixellab/${id}/${gen}`,
    genCount: 1,
    tags: [],
    notes: 'imported; run art:pack -- --id ' + id,
  };
  stub.sourceRef = `art-src/pixellab/${id}/${gen}`;
  stub.status = stub.status === 'approved' ? 'approved' : 'candidate';
  stub.genCount = (stub.genCount ?? 0) + (existing ? 1 : 0);
  if (!existing) registry.assets.push(stub);
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`imported ${id} → art-src/pixellab/${id}/${gen}/raw (${Object.keys(dirMap).length} dirs to normalise at pack)`);
}

main();
