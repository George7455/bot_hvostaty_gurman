import assert from 'node:assert/strict';
import test from 'node:test';

import { getMoscowTimeParts, PLANNED_HOURS } from './index.js';

test('planner uses the required 09:00, 15:00 and 21:00 Moscow slots', () => {
  assert.deepEqual([...PLANNED_HOURS], [9, 15, 21]);
});

test('planner derives schedule keys in Europe/Moscow time', () => {
  const parts = getMoscowTimeParts(new Date('2026-10-07T12:04:00.000Z'));
  assert.deepEqual(parts, { date: '2026-10-07', hour: 15, minute: 4 });
});
