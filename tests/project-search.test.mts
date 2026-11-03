import assert from 'node:assert/strict';
import test from 'node:test';
import { getResource, searchResources } from '../lib/resources.ts';

// Regression: these named searches originally put imports, the same project's repo,
// and even unrelated tools on the floor as separate top-level choices.
test('an Ant Design search counts and displays a single project', () => {
  const result = searchResources({query: 'Ant Design'});
  assert.deepEqual(result.resources.map(item => item.id), ['ant-design']);
  assert.equal(result.total, result.resources.length);
});

test('the Ant Design card keeps its official site, repository and community collection distinguishable', () => {
  const [card] = searchResources({query: 'Ant Design'}).resources;
  assert.equal(new URL(card.url).hostname, 'ant.design');
  const labelFor = (path: string) => card.projectLinks?.find(link => new URL(link.url).pathname === path)?.label;
  assert.match(labelFor('/ant-design/ant-design') ?? '', /github|repo|source/i);
  assert.match(labelFor('/websemantics/awesome-ant-design') ?? '', /community|collection|awesome/i);
});

test('related Ant Design tools link to individually searchable project pages', () => {
  const parent = getResource('ant-design');
  for (const [query, expectedName, expectedSite] of [
    ['Ant Design Charts', /charts/i, 'ant-design-charts.antgroup.com'],
    ['Ant Design Vue', /vue/i, 'antdv.com'],
    ['Ant Design for React Native', /react native/i, 'rn.mobile.ant.design'],
  ] as const) {
    const [first] = searchResources({query}).resources;
    const related = parent?.relatedTools?.find(tool => tool.id === first?.id);
    assert.ok(related, query);
    assert.match(related.name, expectedName, query);
    const destination = getResource(related.id);
    assert.ok(destination, query);
    assert.ok([destination.url, ...(destination.projectLinks || []).map(link => link.url)]
      .some(url => new URL(url).hostname === expectedSite), query);
  }
});

test('an exact Tailwind CSS search leads to the official site instead of a second listing for GitHub', () => {
  const {resources} = searchResources({query: 'Tailwind CSS'});
  assert.deepEqual(resources.map(item => new URL(item.url).hostname), ['tailwindcss.com']);
});

test('Buefy’s website and official repository share one choice outside the curated families', () => {
  const website = 'https://buefy.org/';
  const repository = 'https://github.com/buefy/buefy';
  const {resources} = searchResources({query: 'Buefy'});
  const projectCards = resources.filter(item => item.url === website || item.url === repository);
  assert.equal(projectCards.length, 1);
  assert.equal(projectCards[0].url, website);
  assert.ok(projectCards[0].projectLinks?.some(link => link.url === repository));
});

test('an exact Radix UI search excludes Go data structures with the same word in their names', () => {
  const {resources} = searchResources({query: 'Radix UI'});
  assert.equal(resources[0]?.id, 'radix-ui');
  assert.ok(resources.every(item => !/github\.com\/(plar\/go-adaptive-radix-tree|yourbasic\/radix)/i.test(item.url)));
});

test('the Icons filter on Radix UI brings up its icon set directly', () => {
  const {resources} = searchResources({query: 'Radix UI', category: 'icons'});
  assert.deepEqual(resources.map(item => item.url), ['https://www.radix-ui.com/icons']);
});

test('a Three.js video search finds its tutorials when the main project is outside the filter', () => {
  const {resources} = searchResources({query: 'Three.js', kind: 'video'});
  assert.ok(resources.some(item => item.name === 'JavaScript Tutorial with Three.js - 5 Projects for Beginners'));
  assert.ok(resources.every(item => item.kind === 'video'));
});

test('asking for Ant Design GitHub leads directly to the card that links the official repository', () => {
  const {resources} = searchResources({query: 'Ant Design GitHub'});
  assert.deepEqual(resources.map(item => item.id), ['ant-design']);
  assert.ok(resources[0].projectLinks?.some(link => link.url === 'https://github.com/ant-design/ant-design'));
});

test('the Chrome and Ethereum projects named Lighthouse remain independent choices', () => {
  const {resources} = searchResources({query: 'Lighthouse'});
  const urls = resources.map(item => item.url);
  assert.ok(urls.includes('https://github.com/sigp/lighthouse'));
  assert.ok(urls.some(url => url.startsWith('https://chrome.google.com/webstore/detail/lighthouse/')));
});
