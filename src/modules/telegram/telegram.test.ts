import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAuthorizedTelegramModerator,
  normalizePdfTextForAi,
  parseTelegramIdList,
  splitTelegramText
} from './index.js';

test('Telegram authorization requires an allowed user and an allowed chat', () => {
  const allowlist = {
    userIds: new Set(['101']),
    chatIds: new Set(['-500'])
  };

  assert.equal(isAuthorizedTelegramModerator(allowlist, '101', '-500'), true);
  assert.equal(isAuthorizedTelegramModerator(allowlist, '999', '-500'), false);
  assert.equal(isAuthorizedTelegramModerator(allowlist, '101', '-999'), false);
  assert.equal(isAuthorizedTelegramModerator(allowlist, '101', '101'), true);
});

test('Telegram ID lists and long previews are normalized without changing callback-sized content', () => {
  assert.deepEqual(parseTelegramIdList(' 1, -2,1 '), ['1', '-2', '1']);
  const chunks = splitTelegramText('Первый абзац.\n\n' + 'текст '.repeat(30), 80);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 80));
  assert.equal(chunks.join(' ').includes('Первый абзац.'), true);
});

test('PDF cleanup removes standalone metadata but preserves meaningful short acronyms and durations', () => {
  const normalized = normalizePdfTextForAi([
    'Введение',
    'ОКД',
    'Введение нового корма занимает 10 минут каждый день.',
    'Переход выполняют постепенно и следят за самочувствием собаки.',
    'Похожие статьи',
    'Этот хвост должен быть удалён.'
  ].join('\n'));

  assert.doesNotMatch(normalized, /Этот хвост/);
  assert.doesNotMatch(normalized, /(^|\n)Введение(?=\n|$)/);
  assert.match(normalized, /ОКД/);
  assert.match(normalized, /Введение нового корма занимает 10 минут/);
});
