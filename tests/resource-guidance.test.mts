import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFeaturedResources, getResource, getResources, searchResources, parseResourceGuidance } from '../lib/resources.ts';

const expected = ['shadcn-ui', 'radix-ui', 'base-ui', 'headless-ui', 'lucide', 'motion', 'matter-js', 'three-js', 'playwright', 'vitest', 'react-learn', 'aria-authoring-practices', 'material-ui', 'mantine'];

test('every featured record loads with its authored ID, destination and guidance', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/coding-resources.json', import.meta.url), 'utf8')) as {id: string; url: string; guidance?: unknown}[];
  assert.equal(getFeaturedResources().length, raw.length);
  for (const item of raw) {
    const resource = getResource(item.id);
    assert.ok(resource, item.id);
    assert.equal(resource.url, new URL(item.url).href, item.id);
    assert.equal(resource.featured, true);
    assert.ok(resource.guidance, `Missing or invalid reviewed guidance for ${item.id}`);
  }
});

test('reviewed starting points retain complete guidance through search and JSON serialization', () => {
  for (const id of expected) {
    const resource = getResource(id);
    assert.ok(resource?.guidance, `Missing guidance for ${id}`);
    const g = resource.guidance;
    assert.ok(g.bestFor.trim() && g.caveat.trim());
    assert.ok(g.frameworks.length && g.frameworks.every(f => typeof f === 'string' && f.trim()));
    assert.ok(['low', 'moderate', 'advanced'].includes(g.setup));
    assert.equal(g.checkedAt, '2026-11-02');
    assert.ok(g.sourceUrls.length && g.sourceUrls.every(s => new URL(s).protocol === 'https:'));
    const result = searchResources({ query: resource.name, limit: 100 }).resources.find(r => r.id === id);
    assert.deepEqual(JSON.parse(JSON.stringify(result)).guidance, g);
  }
});

test('design searches surface relevant examples without matching the middle of unrelated URLs', () => {
  assert.equal(searchResources({ query: 'gradients', limit: 1 }).resources[0]?.id, 'gradientora');
  assert.equal(searchResources({ query: 'serif', limit: 1 }).resources[0]?.id, 'geist-serif');
  assert.ok(searchResources({ query: 'microinteractions', limit: 10 }).resources.some(item => item.id === 'amicro'));
  assert.ok(!searchResources({ query: 'laywright' }).resources.some(item => item.id === 'playwright'));
});

test('constructor works as an ordinary JavaScript search term', () => {
  const result = searchResources({ query: 'constructor' });
  assert.equal(result.query, 'constructor');
  assert.ok(result.total > 0);
});

test('old links resolve after duplicate resources merge without adding catalog entries', () => {
  const aliases = JSON.parse(readFileSync(new URL('../data/community-id-aliases.json', import.meta.url), 'utf8')) as Record<string, string>;
  const listed = new Set(getResources().map(r => r.id));
  assert.match(getResource('community-77b4be38215d4c71')?.url ?? '', /github\.com\/ollama\/ollama\/?$/i);
  for (const [oldId, currentId] of Object.entries(aliases)) {
    assert.ok(listed.has(currentId), currentId);
    assert.ok(!listed.has(oldId), oldId);
    assert.equal(getResource(oldId)?.id, currentId, oldId);
  }
});

test('unreviewed imports are not labeled as reviewed', () => {
  assert.ok(getResources().some(r => r.origin === 'community-index'));
  assert.ok(getResources().filter(r => r.origin === 'community-index').every(r => r.guidance === undefined));
});

 test('invalid review metadata cannot earn a checked label', () => {
  const valid = getResource('shadcn-ui')!.guidance!;
  for (const patch of [{ setup: 'easy' }, { sourceUrls: ['javascript:alert(1)'] }, { sourceUrls: [] }, { frameworks: [12] }, { checkedAt: '2026-02-30' }, { bestFor: '  ' }]) {
    assert.equal(parseResourceGuidance({ ...valid, ...patch }), undefined);
  }
  assert.equal(parseResourceGuidance(null), undefined);
  assert.deepEqual(parseResourceGuidance(valid), valid);
});
