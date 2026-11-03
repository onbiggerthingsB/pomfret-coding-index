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
  assert.ok(!sansReact.resources.some(item => [item.name, ...item.tags, ...(item.guidance?.frameworks ?? [])].join(' ').match(/\breact\b/i)));
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
  )));
});
