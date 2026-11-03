import assert from 'node:assert/strict';
import test from 'node:test';
import { searchResources } from '../lib/resources.ts';

const top = (query: string, limit = 5) => searchResources({query, limit}).resources.map(item => item.id);

test('matches student tasks to reviewed use cases and implementation tools', () => {
  assert.equal(top('check my site for accessibility')[0], 'axe-core');
  assert.equal(top('keyboard-friendly menus')[0], 'headless-ui');
  assert.ok(top('test a login page', 3).includes('playwright'));
  assert.ok(top('a homework dashboard with due dates', 4).some(id => ['material-ui', 'shadcn-ui', 'ant-design'].includes(id)));
  assert.ok(top('add a login form', 5).some(id => ['shadcn-ui', 'ant-design', 'material-ui', 'flowbite'].includes(id)));
  const upload = searchResources({query: 'drag and drop file upload', limit: 3}).resources;
  assert.ok(upload.some(item => ['dropzone', 'filepond', 'vue-upload-component'].includes(item.name)));
  assert.ok(searchResources({query: 'authenticate users'}).resources[0]?.tags.join(' ').includes('authentication'));
});

test('holds explicit technology and exclusion terms even on a task search', () => {
  assert.equal(top('accessible modal in Vue')[0], 'headless-ui');
  const sansReact = searchResources({query: 'animate a button without React', limit: 100});
  assert.ok(sansReact.resources.length > 0);
  assert.ok(sansReact.resources.some(item => ['anime-js', 'transitions-dev', 'gustavo-craft'].includes(item.id)));
  assert.ok(sansReact.resources.every(item => !/\breact\b/i.test([item.name, ...item.tags, ...(item.guidance?.frameworks ?? [])].join(' '))
    || item.guidance?.frameworks.some(f => /^(vue|svelte|solid|angular)\b/i.test(f))));
  assert.equal(top('React zxqnonexistent').length, 0);
  assert.equal(top('vue zxqnonexistent').length, 0);
  assert.equal(top('zxqnonexistent').length, 0);
});

test('exact product names, scoped browsing and subsequent pages are stable', () => {
  assert.equal(top('Ant Design')[0], 'ant-design');
  assert.equal(top('No-Login Web Apps', 1).length, 1);
  assert.equal(searchResources({query: 'No-Login Web Apps', limit: 1}).resources[0]?.name, 'No-Login Web Apps');
  const options = { category: 'components', kind: 'library', limit: 9 };
  for (const query of ['', 'components', 'a homework dashboard with due dates']) {
    const first = searchResources({...options, query});
    const rest = searchResources({...options, query, offset: 4, limit: 5});
    assert.equal(first.total, rest.total);
    assert.deepEqual(rest.resources, first.resources.slice(4));
    assert.ok(first.resources.every(item => item.category === 'components' && item.kind === 'library'));
  }
});

const projectPrompts: [string, string[]][] = [
  ['let people pick a date', ['React Aria', 'Date Range Picker']],
  ['I want cards that bounce when I drag them', ['React Spring']],
  ["a map that shows places I've visited", ['mapcn']],
  ['make a sign-up form that works with the keyboard', ['React Aria', 'Bits UI']],
  ["a chart of my soccer team's scores", ['Tremor', 'Football Charts']],
  ['a file uploader where I can drop pictures', ['dropzone', 'Park UI']],
  ['find icons for the navigation bar', ['Lucide', 'Heroicons', 'Remix Icon']],
  ['walk my agent through a new codebase', ['AGENTS.md']],
  ['build a personal portfolio with smooth transitions', ['Transitions.dev', 'Codrops', 'React Bits']],
  ['learn how to debug a broken button', ['Chrome DevTools']],
  ['add a calendar to my Svelte site', ['svelte-calendar', 'date-picker-svelte']],
];

for (const [query, expected] of projectPrompts) {
  test(query, () => {
    const results = searchResources({query, limit: 3}).resources;
    assert.ok(results.some(item => expected.includes(item.name)), results.map(item => item.name).join(', '));
  });
}

test('negative terms filter single, combined and standalone searches', () => {
  const reference = top('button animation without React or Vue');
  assert.ok(reference.length);
  for (const query of ['button animation -React -Vue', 'button animation do not use React or Vue']) {
    assert.deepEqual(top(query), reference);
  }
  const excluded = searchResources({query: 'without React or Vue', category: 'components', limit: 100});
  assert.ok(excluded.total > 0);
  assert.ok(excluded.resources.every(item => !/\b(?:React|Vue)\b/i.test(
    [item.name, ...item.tags, item.description, ...(item.guidance?.frameworks ?? []), item.guidance?.bestFor].join(' '),
  ) || item.guidance?.frameworks.some(f => /^(svelte|solid|angular)\b/i.test(f))));
});

test('equivalent exclusions never reverse the requested framework', () => {
  const reference = top('a modal without React', 20);
  assert.ok(reference.includes('headless-ui'), 'reviewed Vue implementation works without React');
  assert.ok(reference.length > 0);
  assert.ok(!reference.includes('heroui'));
  assert.ok(!reference.includes('react-aria'));
  for (const query of [
    'a modal that does not require React', "a modal that doesn't need React",
    'a modal without having to install React', 'a modal that works without React',
    'a modal with no dependency on React',
  ]) assert.deepEqual(top(query, 20), reference, query);
});

test('explicit runtime conditions cannot be satisfied by a different ecosystem', () => {
  assert.ok(top('Flutter', 1).length);
  const flutter = searchResources({query: 'a calendar for a Flutter app', limit: 100}).resources;
  assert.ok(!flutter.some(item => item.id === 'react-aria'));
  assert.ok(flutter.every(item =>
    /\bflutter\b/i.test([item.name, ...item.tags, ...(item.guidance?.frameworks ?? [])].join(' '))));
  const vanilla = top('animations in plain JavaScript', 10);
  assert.ok(vanilla.includes('anime-js'));
  assert.ok(!vanilla.includes('react-spring') && !vanilla.includes('react-bits'));
  assert.deepEqual(top('animations in vanilla JS', 10), vanilla);
});

test('distinctive subjects survive generic details and interaction verbs', () => {
  for (const query of [
    'kanban board', 'a kanban board where I drag cards between columns',
    'make a kanban board for homework', 'kanban columns for a student newspaper',
    'put cards into columns and drag them between todo and done', 'move tickets across lanes',
  ]) {
    const results = searchResources({query, limit: 3}).resources;
    assert.ok(results.length, query);
    assert.ok(results.every(item => /kanban/i.test(item.name)), JSON.stringify([query, results.map(item => item.name)]));
  }
});

test('a browser-only API request finds a native implementation reference', () => {
  for (const query of ['only browser APIs for dialogs', 'modal with native browser APIs', 'dialogs with browser APIs only']) {
    assert.ok(top(query).includes('mdn-learn'), query);
    assert.ok(searchResources({ query }).resources.every(item => item.kind === 'documentation'), query);
  }
  assert.equal(top('only browser APIs for zxqimaginary').length, 0);
});

test('exact pasted destinations resolve before ordinary words, including tracking and fragments', () => {
  assert.deepEqual(top('https://www.mui.com/?utm_source=class#docs'), ['material-ui']);
  assert.deepEqual(top('https://headlessui.com/'), ['headless-ui']);
  assert.deepEqual(top('https://www.typescriptlang.org/docs/handbook/intro.html'), ['typescript-handbook']);
  assert.deepEqual(top('https://unlisted.example/kanban'), []);
  assert.equal(searchResources({query: 'https://mui.com/', category: 'icons'}).total, 0);
});

test('explicit alternatives and cumulative requirements have different results', () => {
  const alternatives = top('modal in React or Vue', 100);
  assert.ok(alternatives.includes('heroui') && alternatives.includes('primevue'));
  const vueOnly = top('modal in Vue without React', 100);
  assert.ok(vueOnly.includes('headless-ui') && !vueOnly.includes('heroui'));
});

test('a keyless API query keeps only entries with verified access and retains their conditions', () => {
  for (const query of [
    'weather API no key', 'a weather forecast without an API key',
    'weather that doesn’t require an API key', 'weather forecast without needing to provide an API key',
    'a weather API where no API key is needed', 'keyless weather API',
  ]) {
    const result = searchResources({query, limit: 100});
    assert.deepEqual(result.filters, {apiKey: 'not-required'}, query);
    assert.ok(result.resources.some(item => item.name === 'Open-Meteo'), query);
    assert.ok(result.resources.every(item =>
      item.requirements && item.requirements.apiKey !== 'required' && item.requirements.sourceUrl));
    assert.ok(!result.resources.some(item => item.name === 'Pirate Weather'), query);
  }
  const commercial = searchResources({query: 'commercial weather API without an API key'});
  assert.ok(commercial.resources.length);
  assert.ok(commercial.resources.every(item => item.requirements?.apiKey === 'not-required'));
});

test('a generic resource type cannot satisfy an unrelated project description', () => {
  const trivia = searchResources({query: 'an API for trivia without a key'}).resources;
  assert.deepEqual(trivia.map(item => item.name), ['Open Trivia']);
  assert.deepEqual(top('a library for zxqnonexistent'), []);
  assert.deepEqual(top('an API for zxqnonexistent without a key'), []);
});
