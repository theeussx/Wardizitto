import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import { z } from 'zod';

import {
  ExternalServiceError,
  PermissionError,
  ValidationError,
} from '../../../../../core/errors/app-error.js';
import { readLimitedBody } from '../../../../../infrastructure/http/safe-http-client.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';
import {
  serverPlanPreview,
  serverPlanSchema,
  type ServerPlan,
} from '../../../application/server-plan.js';

const permissions = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] as const;
const providerReply = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().max(30_000) }) })).min(1),
});

export const data = new SlashCommandBuilder()
  .setName('criar-servidor')
  .setDescription('Planeja e adiciona canais e cargos com auxílio de IA.')
  .setDefaultMemberPermissions(permissions.reduce((all, flag) => all | flag, 0n))
  .addStringOption((option) =>
    option
      .setName('descricao')
      .setDescription('Descreva a comunidade desejada. O texto é enviado à Groq.')
      .setMinLength(10)
      .setMaxLength(500)
      .setRequired(true),
  );
export const access = { guildOnly: true, guildPermissions: permissions } as const;
export const cooldownMs = 60_000;

async function generate(
  description: string,
  config: WardizittoClient['services']['config'],
): Promise<ServerPlan> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${config.GROQ_API_KEY ?? ''}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Return a JSON object with roles (max 12, name and optional #RRGGBB color only) and categories (max 8, name and channels). Each channel has name and type (text or voice). Max 8 channels per category, 24 in total. Names must be 1–60 characters. Do not output permissions or any additional fields. Include both arrays.',
          },
          { role: 'user', content: description },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2400,
      }),
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${String(response.status)}`);
    }
    const bytes = await readLimitedBody(response, Math.min(config.HTTP_MAX_RESPONSE_BYTES, 64_000));
    const { choices } = providerReply.parse(JSON.parse(new TextDecoder().decode(bytes)));
    const content = choices[0]?.message.content ?? '';
    return serverPlanSchema.parse(JSON.parse(content));
  } catch {
    throw new ExternalServiceError(
      'Groq',
      'Não consegui gerar uma estrutura válida. Tente novamente.',
      { expose: true },
    );
  }
}

function assertBotPermissions(guild: Guild): void {
  if (!guild.available || !guild.members.me?.permissions.has(permissions)) {
    throw new PermissionError('Preciso das permissões Gerenciar Canais e Gerenciar Cargos.');
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  if (!interaction.inCachedGuild() || !interaction.member.permissions.has(permissions)) {
    throw new PermissionError();
  }
  if (interaction.options.getBoolean('limpar') === true) {
    throw new ValidationError(
      'A opção de apagar recursos foi desativada. Execute o comando sem essa opção.',
    );
  }
  if (!client.services.config.GROQ_API_KEY) {
    throw new ValidationError('A geração de estruturas por IA está indisponível nesta instalação.');
  }
  const { guild, user } = interaction;
  assertBotPermissions(guild);
  const description = interaction.options.getString('descricao', true).trim();
  if (description.length < 10 || description.length > 500) {
    throw new ValidationError('A descrição precisa ter entre 10 e 500 caracteres.');
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const plan = await generate(description, client.services.config);
  const preview = serverPlanPreview(plan);
  if (preview.length > 4096)
    throw new ValidationError('A estrutura ficou longa demais para a prévia.');
  const confirmId = 'server-plan:v1:confirm';
  const cancelId = 'server-plan:v1:cancel';
  const message = await interaction.editReply({
    embeds: [new EmbedBuilder().setTitle('Prévia da estrutura').setDescription(preview)],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel('Adicionar estrutura')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] },
  });
  const confirmation = await message
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (button) =>
        button.guildId === guild.id &&
        button.user.id === user.id &&
        (button.customId === confirmId || button.customId === cancelId),
      time: 60_000,
    })
    .catch(() => undefined);
  if (confirmation) await confirmation.deferUpdate();
  if (confirmation?.customId !== confirmId) {
    await interaction.editReply({
      content: 'Prévia encerrada. Nenhum recurso foi criado.',
      embeds: [],
      components: [],
    });
    return;
  }
  await guild.roles.fetch();
  const member = await guild.members.fetch({ user: user.id, force: true });
  if (!member.permissions.has(permissions)) {
    await interaction.editReply({
      content: 'Você não tem mais permissão para aplicar a estrutura.',
      embeds: [],
      components: [],
    });
    return;
  }
  assertBotPermissions(guild);
  await interaction.editReply({ content: 'Adicionando estrutura…', embeds: [], components: [] });

  const created = { roles: 0, categories: 0, channels: 0 };
  const reason = `Estrutura confirmada por ${user.id}`;
  let completed = false;
  try {
    for (const role of plan.roles) {
      await guild.roles.create({
        name: role.name,
        permissions: 0n,
        reason,
        ...(role.color ? { color: role.color as `#${string}` } : {}),
      });
      created.roles += 1;
    }
    for (const group of plan.categories) {
      const parent = await guild.channels.create({
        name: group.name,
        type: ChannelType.GuildCategory,
        reason,
      });
      created.categories += 1;
      for (const channel of group.channels) {
        await guild.channels.create({
          name: channel.name,
          parent: parent.id,
          type: channel.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
          reason,
        });
        created.channels += 1;
      }
    }
    completed = true;
  } catch (error) {
    client.services.logger.error('Falha ao adicionar estrutura confirmada.', error, {
      guildId: guild.id,
    });
  } finally {
    client.services.logger.audit('Execução de estrutura de servidor.', {
      actorId: user.id,
      guildId: guild.id,
      ...created,
      completed,
    });
  }
  const counts = `${String(created.roles)} cargos, ${String(created.categories)} categorias e ${String(created.channels)} canais confirmados.`;
  await interaction.editReply(
    completed
      ? `Estrutura adicionada. ${counts}`
      : `A criação foi interrompida. ${counts} Confira os recursos no servidor antes de tentar novamente.`,
  );
}
