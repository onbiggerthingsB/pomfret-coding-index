import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFeaturedResources, getResource, getResources, searchResources, parseResourceGuidance } from '../lib/resources.ts';

const expected = ['shadcn-ui', 'radix-ui', 'base-ui', 'headless-ui', 'lucide', 'motion', 'matter-js', 'three-js', 'playwright', 'vitest', 'react-learn', 'aria-authoring-practices', 'material-ui', 'mantine'];

test('guidance preserves all curated resource IDs, URLs and count', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/coding-resources.json', import.meta.url), 'utf8'));
  assert.equal(raw.length, 90);
  assert.equal(createHash('sha256').update(JSON.stringify(raw.map((r: {id: string; url: string}) => [r.id, r.url]))).digest('hex'), 'ce33dcf35ea650e63746bbe5a47dcf6b092df2c979e7b580fa7196f5ecdcf9d4');
  assert.equal(getFeaturedResources().length, 90);
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
