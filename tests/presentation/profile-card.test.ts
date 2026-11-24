import { expect, it, vi } from 'vitest';

import { renderProfileCard } from '../../src/core/design/profile-card.js';

const profile = {
  name: '👩🏽‍💻 Wardizitto — 世界'.repeat(10),
  profession: 'Projetista',
  level: 20,
  xp: 300,
  nextLevelXp: 10_000,
  wallet: 9_223_372_036_854_775_807n,
  bank: 9_223_372_036_854_775_807n,
  locale: 'pt-BR',
} as const;

it('gera PNG com tamanho estável, caracteres Unicode e saldo bigint', async () => {
  const png = await renderProfileCard(profile);
  expect(png?.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png?.readUInt32BE(16)).toBe(900);
  expect(png?.readUInt32BE(20)).toBe(364);
});

it('não faz chamadas fora do CDN oficial e renderiza um avatar alternativo', async () => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  try {
    const png = await renderProfileCard({
      ...profile,
      avatarUrl: 'https://cdn.discordapp.com.example.com/embed/avatars/1.png',
      locale: 'en-US',
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('limita renderizações simultâneas e mantém o fallback quando o CDN falha', async () => {
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 503 })));
  vi.stubGlobal('fetch', fetcher);
  try {
    const results = await Promise.all(
      Array.from({ length: 9 }, () =>
        renderProfileCard({
          ...profile,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
        }),
      ),
    );
    expect(results.filter(Buffer.isBuffer)).toHaveLength(8);
    expect(results.at(-1)).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(8);
  } finally {
    vi.unstubAllGlobals();
  }
});
