import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\p{Cc}\p{Cf}]+$/u);

export const serverPlanSchema = z
  .strictObject({
    roles: z
      .array(
        z.strictObject({
          name,
          color: z
            .string()
            .regex(/^#[0-9a-f]{6}$/iu)
            .optional(),
        }),
      )
      .max(12),
    categories: z
      .array(
        z.strictObject({
          name,
          channels: z.array(z.strictObject({ name, type: z.enum(['text', 'voice']) })).max(8),
        }),
      )
      .max(8),
  })
  .refine(
    ({ roles, categories }) =>
      roles.length + categories.length > 0 &&
      categories.reduce((total, category) => total + category.channels.length, 0) <= 24,
    'Estrutura vazia ou acima do limite de canais.',
  );

export type ServerPlan = z.infer<typeof serverPlanSchema>;

export function serverPlanPreview(plan: ServerPlan): string {
  const safe = (value: string): string =>
    value.replace(/[\\`*_~|[\]<>]/gu, '\\$&').replaceAll('@', '@\u200b');
  return [
    'Confira a estrutura antes de adicionar os recursos. Os cargos serão criados sem permissões adicionais.',
    '',
    ...plan.roles.map(
      (role) => `Cargo · ${safe(role.name)}${role.color ? ` (${role.color})` : ''}`,
    ),
    ...plan.categories.flatMap((category) => [
      `**${safe(category.name)}**`,
      ...category.channels.map(
        (channel) => ` · ${channel.type === 'voice' ? 'Voz' : 'Texto'}: ${safe(channel.name)}`,
      ),
    ]),
  ].join('\n');
}
