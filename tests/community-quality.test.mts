import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { communityIdAliases, curateCommunity } from '../scripts/community-quality.mjs';
import { parseResources } from '../scripts/import-awesome.mjs';

const source = { repo: 'Practical-Tutorials/project-based-learning', name: 'project-based-learning', branch: 'master', file: 'README.md', category: 'learning', tags: ['tutorials'], sourceUrl: 'https://github.com/Practical-Tutorials/project-based-learning/blob/master/README.md' };

test('tutorial chapters keep their project context, working fragments, trailing slashes and existing saved IDs', () => {
  const rows = parseResources('# Projects\n## Web\n- Build a browser game\n  - [Part 1](https://tutorial.org/game/#start)\n', source);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Build a browser game — Part 1');
  assert.equal(rows[0].url, 'https://tutorial.org/game/#start');
  assert.equal(rows[0].id, 'community-' + createHash('sha256').update('https://tutorial.org/game').digest('hex').slice(0, 16));
});

test('confirmed link findings apply on import, while historical instruction and working repairs survive', () => {
  const row = (name: string, url: string, kind = 'library') => ({ id: name, name, url, kind, category: 'tools', tags: [], sourceUrl: source.sourceUrl, description: `Explore ${name} in tools.` });
  const items = [row('Old library', 'https://github.com/old/code'), row('Historical lesson', 'https://github.com/old/code/blob/main/lesson.md', 'documentation'), row('Broken', 'https://example.org/books/missing'), row('Managed guide', 'https://example.org/guide'), row('old/moved', 'https://github.com/old/moved'), row('GitHub App', 'https://github.com/apps/guardrails')];
  const featured = [row('Moved project', 'https://github.com/New/Moved')];
  const review = { repositoryAliases: { 'old/moved': 'New/Moved' }, repairs: { 'https://example.org/guide': 'https://example.org/guide/' }, repositories: { 'archived package repository': ['old/code'] }, destinations: { 'confirmed missing destination': ['https://example.org/books/missing'] } };
  const { kept, removed } = curateCommunity(items, featured, review);
  assert.deepEqual(kept.map((item: {name: string}) => item.name), ['Historical lesson', 'Managed guide', 'GitHub App']);
  assert.equal(kept[1].url, 'https://example.org/guide/');
  assert.deepEqual(removed, { 'archived package repository': 1, 'confirmed missing destination': 1, 'duplicate destination': 1 });
});

test('a stable replacement survives upstream ordering and archival metadata distinguishes courses from dependencies', () => {
  const row = (id: string, url: string) => ({ id, name: id, url, kind: 'library', category: 'tools', tags: [], sourceUrl: source.sourceUrl, description: id });
  const current = 'https://docs.example.org/stable/';
  const v1 = row('v1', 'https://docs.example.org/1.pdf');
  const v2 = row('v2', 'https://docs.example.org/2.pdf');
  const lessons = row('lessons', 'https://github.com/teachers/lessons');
  const review = {
    repositoryAliases: {}, destinations: {}, repositories: { 'archived package repository': ['teachers/lessons'] },
    repairs: { [v1.url]: current, [v2.url]: current },
    resourceDetails: {
      'https://docs.example.org/stable': { id: 'stable-manual', kind: 'documentation', name: 'Current manual' },
      [lessons.url]: { kind: 'documentation', name: 'Archived course notebooks' },
    },
  };
  for (const rows of [[v1, v2, lessons], [v2, v1, lessons]]) {
    const { kept, removed } = curateCommunity(rows, [], review);
    assert.deepEqual(kept.map(({ id }: { id: string }) => id), ['stable-manual', 'lessons']);
    assert.equal(kept[0].url, current);
    assert.equal(kept[1].kind, 'documentation');
    assert.deepEqual(removed, { 'duplicate destination': 1 });
  }
});

test('saved links migrate only to available equivalent destinations and stay direct after a second migration', () => {
  const row = (id: string, url: string) => ({ id, url });
  const prior = [row('old', 'https://github.com/first/tools/blob/main/A.md'), row('book', 'https://example.org/book.pdf'), row('dead', 'https://example.org/gone')];
  const current = [row('new', 'https://github.com/current/tools/blob/main/A.md'), row('manual', 'https://example.org/book/')];
  const review = { repairs: { 'https://example.org/book.pdf': 'https://example.org/book/' }, repositoryAliases: { 'first/tools': 'current/tools' } };
  assert.deepEqual(communityIdAliases(prior, current, review, { older: 'old', 'also-dead': 'dead', new: 'manual' }), { book: 'manual', old: 'new', older: 'new' });
});
