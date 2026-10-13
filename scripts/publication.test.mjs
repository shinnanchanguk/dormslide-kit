import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { notifyPublication, writePublication } from './publication.mjs';

const sourceSha = 'a'.repeat(40);
const secret = 'test-only-publication-credential';
const payload = { sourceSha, result: 'success', secret };

async function serverFixture(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return {
    fetchImpl: (url, options) => {
      assert.equal(url, 'https://dorms.school/api/dormslide/publications/complete');
      return fetch(`http://127.0.0.1:${server.address().port}/complete`, options);
    },
  };
}

test('manifest hashes exact served bytes and changes when either artifact changes', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'publication-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = '{"title":"디자인"}\n';
  const index = '<html>preview</html>\n';
  await writeFile(path.join(directory, 'catalog.json'), catalog);
  await writeFile(path.join(directory, 'index.html'), index);
  const expected = {
    version: 1, sourceSha,
    catalogSha256: createHash('sha256').update(catalog).digest('hex'),
    indexSha256: createHash('sha256').update(index).digest('hex'),
  };
  assert.deepEqual(await writePublication(directory, sourceSha), expected);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'publication.json'), 'utf8')), expected);
  await writeFile(path.join(directory, 'catalog.json'), catalog.trimEnd());
  assert.notEqual((await writePublication(directory, sourceSha)).catalogSha256, expected.catalogSha256);
  await writeFile(path.join(directory, 'index.html'), '<html>new preview</html>');
  assert.notEqual((await writePublication(directory, sourceSha)).indexSha256, expected.indexSha256);
  await assert.rejects(writePublication(directory, 'short'), /GITHUB_SHA/);
  await rm(path.join(directory, 'index.html'));
  await assert.rejects(writePublication(directory, sourceSha), /ENOENT/);
});

test('delivers authenticated completion and retries transient failures', async (t) => {
  let calls = 0;
  const sleeps = [];
  const options = await serverFixture(t, async (req, res) => {
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { sourceSha, result: 'success' });
    calls++;
    res.writeHead(calls < 3 ? 503 : 200).end();
  });
  await notifyPublication(payload, { ...options, sleep: async (ms) => sleeps.push(ms), log() {} });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [5_000, 15_000]);
});

test('failure completion is delivered too', async (t) => {
  const options = await serverFixture(t, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks)).result, 'failure');
    res.writeHead(204).end();
  });
  await notifyPublication({ ...payload, result: 'failure' }, { ...options, log() {} });
});

test('exhausts exactly five requests without logging server bodies or credentials', async (t) => {
  const logs = [];
  const sleeps = [];
  let calls = 0;
  const options = await serverFixture(t, (_req, res) => {
    calls++;
    res.writeHead(401).end(secret);
  });
  await assert.rejects(notifyPublication(payload, { ...options, sleep: async (ms) => sleeps.push(ms), log: (line) => logs.push(line) }), /after 5 attempts/);
  assert.equal(calls, 5);
  assert.deepEqual(sleeps, [5_000, 15_000, 45_000, 90_000]);
  assert.equal(logs.join('').includes(secret), false);
});

test('timeouts retry and redirects cannot forward credentials', async (t) => {
  let redirected = false;
  const options = await serverFixture(t, (req, res) => {
    if (req.url === '/leak') { redirected = true; res.end(); }
    else res.writeHead(307, { Location: '/leak' }).end();
  });
  await assert.rejects(notifyPublication(payload, { ...options, sleep: async () => {}, log() {} }), /after 5 attempts/);
  assert.equal(redirected, false);
  const hanging = await serverFixture(t, () => {});
  await assert.rejects(notifyPublication(payload, { ...hanging, timeoutMs: 20, sleep: async () => {}, log() {} }), /after 5 attempts/);
});

test('invalid configuration never makes a request or discloses fetch errors', async () => {
  const fetchImpl = () => { throw new Error('must not call'); };
  for (const config of [{ ...payload, secret: '' }, { ...payload, sourceSha: 'bad' }, { ...payload, result: 'cancelled' }]) {
    await assert.rejects(notifyPublication(config, { fetchImpl }));
  }
  const logs = [];
  await assert.rejects(notifyPublication(payload, {
    fetchImpl: () => { throw new Error(secret); }, sleep: async () => {}, log: (line) => logs.push(line),
  }), /after 5 attempts/);
  assert.equal(logs.join('').includes(secret), false);
});
