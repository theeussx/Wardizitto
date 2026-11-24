import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';

import { readLimitedBody } from '../../infrastructure/http/safe-http-client.js';
import type { Locale } from '../localization/translator.js';
import { discordTheme } from './discord-theme.js';

const width = 900;
const height = 364;
const maxConcurrentRenders = 8;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const avatarPath = /^\/(?:avatars\/\d{17,20}\/(?:a_)?[a-f0-9]{32}|embed\/avatars\/[0-5])\.png$/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
let concurrentRenders = 0;

const copy = {
  'pt-BR': {
    wallet: 'Carteira',
    bank: 'Banco',
    level: 'Nível',
    progress: 'Progresso',
    noProfession: 'Sem profissão',
  },
  'en-US': {
    wallet: 'Wallet',
    bank: 'Bank',
    level: 'Level',
    progress: 'Progress',
    noProfession: 'No profession',
  },
} as const;

export interface ProfileCardData {
  readonly name: string;
  readonly avatarUrl?: string;
  readonly profession: string | null;
  readonly level: number;
  readonly xp: number;
  readonly nextLevelXp: number;
  readonly wallet: bigint;
  readonly bank: bigint;
  readonly locale: Locale;
}

async function avatarImage(value?: string): Promise<Image | undefined> {
  if (!value) return undefined;
  const url = URL.parse(value);
  if (
    url?.origin !== 'https://cdn.discordapp.com' ||
    url.username ||
    url.password ||
    !avatarPath.test(url.pathname)
  )
    return undefined;
  url.search = '?size=128';
  url.hash = '';

  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1500) });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png') {
      await response.body?.cancel();
      return undefined;
    }
    const bytes = Buffer.from(await readLimitedBody(response, 128 * 1024));
    if (
      bytes.length < 24 ||
      !bytes.subarray(0, 8).equals(pngSignature) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR'
    )
      return undefined;
    const size = bytes.readUInt32BE(16);
    if (size < 1 || size > 256 || size !== bytes.readUInt32BE(20)) return undefined;
    return await loadImage(bytes);
  } catch {
    return undefined;
  }
}

export async function renderProfileCard(data: ProfileCardData): Promise<Buffer | undefined> {
  if (concurrentRenders >= maxConcurrentRenders) return undefined;
  concurrentRenders += 1;
  try {
    const avatar = await avatarImage(data.avatarUrl);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const colors = discordTheme.colors;
    const text = copy[data.locale];
    const numbers = new Intl.NumberFormat(data.locale);
    const level = Math.max(1, data.level);
    const xp = Math.max(0, data.xp);
    const nextLevelXp = Math.max(1, data.nextLevelXp);

    const label = (
      value: string,
      x: number,
      y: number,
      font: string,
      color: string,
      available: number,
    ): void => {
      ctx.font = `${font} "DejaVu Sans", sans-serif`;
      ctx.fillStyle = color;
      if (ctx.measureText(value).width > available) {
        let prefix = '';
        for (const { segment } of segmenter.segment(value)) {
          if (ctx.measureText(`${prefix}${segment}…`).width > available) break;
          prefix += segment;
        }
        value = `${prefix}…`;
      }
      ctx.fillText(value, x, y);
    };

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, 6, height);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(6, 176, width - 6, height - 176);

    ctx.save();
    ctx.beginPath();
    ctx.arc(106, 87, 54, 0, 2 * Math.PI);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, 52, 33, 108, 108);
    } else {
      ctx.fillStyle = colors.border;
      ctx.fillRect(52, 33, 108, 108);
      ctx.textAlign = 'center';
      const first = segmenter.segment(data.name).containing(0)?.segment ?? 'W';
      label(first.toLocaleUpperCase(data.locale), 106, 104, 'bold 43px', colors.text, 96);
    }
    ctx.restore();

    label(data.name, 190, 83, 'bold 46px', colors.text, 656);
    label(data.profession || text.noProfession, 192, 125, '22px', colors.muted, 445);
    ctx.textAlign = 'right';
    label(
      `${text.level} ${numbers.format(level)}`,
      width - 52,
      125,
      'bold 22px',
      colors.highlight,
      184,
    );
    ctx.textAlign = 'left';

    label(text.wallet, 52, 211, '20px', colors.muted, 360);
    label(text.bank, 452, 211, '20px', colors.muted, 360);
    label(numbers.format(data.wallet), 52, 254, 'bold 26px', colors.text, 370);
    label(numbers.format(data.bank), 452, 254, 'bold 26px', colors.text, 396);

    label(text.progress, 52, 302, '18px', colors.muted, 290);
    ctx.textAlign = 'right';
    label(
      `${numbers.format(xp)} / ${numbers.format(nextLevelXp)} XP`,
      width - 52,
      302,
      '18px',
      colors.text,
      460,
    );
    ctx.fillStyle = colors.border;
    ctx.fillRect(52, 318, width - 104, 8);
    ctx.fillStyle = colors.primary;
    ctx.fillRect(52, 318, Math.min(xp / nextLevelXp, 1) * (width - 104), 8);
    return await canvas.encode('png');
  } finally {
    concurrentRenders -= 1;
  }
}
