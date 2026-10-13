#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const endpoint = 'https://dorms.school/api/dormslide/publications/complete';
const retryDelays = [5_000, 15_000, 45_000, 90_000];

function validateSha(sourceSha) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('A full GITHUB_SHA is required.');
}

export async function writePublication(directory, sourceSha) {
  validateSha(sourceSha);
  const hash = async (name) => createHash('sha256').update(await readFile(path.join(directory, name))).digest('hex');
  const manifest = {
    version: 1,
    sourceSha,
    catalogSha256: await hash('catalog.json'),
    indexSha256: await hash('index.html'),
  };
  await writeFile(path.join(directory, 'publication.json'), JSON.stringify(manifest) + '\n');
  return manifest;
}

export async function notifyPublication({ sourceSha, result, secret }, {
  fetchImpl = fetch,
  sleep = delay,
  timeoutMs = 12_000,
  log = console.log,
} = {}) {
  validateSha(sourceSha);
  if (!['success', 'failure'].includes(result)) throw new Error('PUBLICATION_RESULT must be success or failure.');
  if (!secret?.trim()) throw new Error('Configure the DORMSLIDE_PUBLISH_SECRET repository secret before publishing.');
  for (let attempt = 0; attempt < 5; attempt++) {
    let status = 'network error or timeout';
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSha, result }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Never log a response body or request error, which could reflect credentials.
      await response.body?.cancel();
      if (response.ok) {
        log('Publication completion delivered.');
        return;
      }
      status = `HTTP ${response.status}`;
    } catch {
      // Only a fixed, credential-free failure summary is printed below.
    }
    log(`Publication completion attempt ${attempt + 1}/5 failed (${status}).`);
    if (attempt < retryDelays.length) await sleep(retryDelays[attempt]);
  }
  throw new Error('Publication completion could not be delivered after 5 attempts. Rerun this job after checking the server and repository secret.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === 'manifest') {
      await writePublication('dist', process.env.GITHUB_SHA);
    } else if (process.argv[2] === 'notify') {
      await notifyPublication({ sourceSha: process.env.GITHUB_SHA, result: process.env.PUBLICATION_RESULT, secret: process.env.DORMSLIDE_PUBLISH_SECRET });
    } else {
      throw new Error('Usage: node scripts/publication.mjs manifest|notify');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
