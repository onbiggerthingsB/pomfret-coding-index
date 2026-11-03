import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getCommunityMetadata } from '../lib/community-metadata.ts';
import { getFeaturedResources, getResource, getResources, searchResources, parseResourceGuidance, type ResourceGuidance } from '../lib/resources.ts';

const expected = ['shadcn-ui', 'radix-ui', 'base-ui', 'headless-ui', 'lucide', 'motion', 'matter-js', 'three-js', 'playwright', 'vitest', 'react-learn', 'aria-authoring-practices', 'material-ui', 'mantine'];
const communityCards = JSON.parse(readFileSync(new URL('../data/community-cards.json', import.meta.url), 'utf8')) as Record<string, { description: string; kind: string; guidance: ResourceGuidance }>;

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

test('the 252 opening community tiles resolve to distinct reviewed resources with evidence', () => {
  const floor = JSON.parse(readFileSync(new URL('../data/floor-community.json', import.meta.url), 'utf8')) as string[];
  const opening = floor.slice(0, 252);
  assert.equal(opening.length, 252);
  assert.equal(new Set(opening).size, 252);
  assert.equal(opening[136], 'community-7f6d808bb0169574', 'Vueform replaces the second draw.io tile');
  assert.equal(getResource(opening[136])?.url, 'https://vueform.com/');
  assert.ok(opening.includes('community-511343c5e0711328'), 'the original draw.io tile remains');
  assert.ok(!opening.includes('community-5c59cd357f820dc4'));

  const useCases = new Set<string>();
  const caveats = new Set<string>();
  for (const id of opening) {
    assert.ok(Object.hasOwn(communityCards, id), `No reviewed card for ${id}`);
    const { guidance } = communityCards[id];
    useCases.add(guidance.bestFor);
    caveats.add(guidance.caveat);
  }
  assert.equal(useCases.size, opening.length, 'each tile describes its own use case');
  assert.equal(caveats.size, opening.length, 'each tile explains its own caveat');
});

test('every reviewed community card resolves to its canonical ID and exposes its authored evidence', () => {
  for (const [id, card] of Object.entries(communityCards)) {
    const resource = getResource(id);
    assert.ok(resource, id);
    assert.equal(resource.id, id, `Card points to an alias: ${id}`);
    assert.equal(resource.origin, 'community-index', id);
    assert.equal(resource.featured, false, id);
    assert.ok(card.description.trim(), id);
    assert.equal(resource.description, card.description.trim(), id);
    assert.equal(resource.kind, card.kind, id);
    const guide = resource.guidance;
    assert.ok(guide, `Reviewed guidance missing from catalog for ${id}`);
    assert.ok(guide.bestFor && guide.caveat && guide.frameworks.length > 0, id);
    assert.ok(guide.frameworks.every(framework => framework.trim()), id);
    assert.ok(['low', 'moderate', 'advanced'].includes(guide.setup), id);
    assert.match(guide.checkedAt, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(guide.sourceUrls.length > 0, id);
    assert.deepEqual(guide.sourceUrls, card.guidance.sourceUrls.map(source => new URL(source).href), id);
    for (const source of guide.sourceUrls) {
      const url = new URL(source);
      assert.ok(url.protocol === 'https:' && !url.username && !url.password, `${id} cites ${source}`);
    }
  }
});

test('catalog imports without a reviewed card do not inherit a checked label', () => {
  const unreviewed = getResources().filter(resource => resource.origin === 'community-index' && !Object.hasOwn(communityCards, resource.id));
  assert.ok(unreviewed.length > 0);
  for (const resource of unreviewed) {
    assert.equal(resource.guidance, undefined, resource.id);
  }
});

test('metadata treats unknown IDs and inherited object keys as missing', () => {
  for (const id of ['community-missing', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(getCommunityMetadata(id), undefined, id);
    assert.equal(getResource(id), undefined, id);
  }
});

test('invalid review metadata cannot earn a checked label', () => {
  const valid = getResource('shadcn-ui')!.guidance!;
  for (const patch of [{ setup: 'easy' }, { sourceUrls: ['javascript:alert(1)'] }, { sourceUrls: [] }, { frameworks: [12] }, { checkedAt: '2026-02-30' }, { bestFor: '  ' }]) {
    assert.equal(parseResourceGuidance({ ...valid, ...patch }), undefined);
  }
  assert.equal(parseResourceGuidance(null), undefined);
  assert.deepEqual(parseResourceGuidance(valid), valid);
});
