import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from './app.js';

test('health endpoint responds without starting external integrations', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    const body = response.json<{ status: string; service: string }>();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'telegram-editorial-pipeline');
  } finally {
    await app.close();
  }
});
