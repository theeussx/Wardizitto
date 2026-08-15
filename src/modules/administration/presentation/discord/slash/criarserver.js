const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  Colors,
} = require('discord.js');
const { z } = require('zod');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const permissionNames = [
  'Administrator',
  'ManageGuild',
  'ManageChannels',
  'ManageRoles',
  'ManageMessages',
  'ModerateMembers',
  'KickMembers',
  'BanMembers',
  'ViewAuditLog',
];
const generatedSchema = z.object({
  roles: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        color: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
        permissions: z.array(z.enum(permissionNames)).max(9).default([]),
      }),
    )
    .max(20)
    .default([]),
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        channels: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(100),
              type: z.enum(['text', 'voice']),
            }),
          )
          .max(20),
      }),
    )
    .max(20)
    .default([]),
});

const generateConfiguration = async (description, config) => {
  if (!config.GROQ_API_KEY) throw new Error('A integração Groq não está configurada.');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.GROQ_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Create a Discord server structure. Return only JSON with roles and categories. Channel type is text or voice. Never include Administrator unless explicitly requested.',
        },
        { role: 'user', content: description },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(config.HTTP_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Groq respondeu HTTP ${response.status}.`);
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length > 100_000) {
    throw new Error('A IA retornou uma resposta inválida.');
  }
  return generatedSchema.parse(JSON.parse(content));
};

const clearGuild = async (guild, preservedChannelId) => {
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (channel.id !== preservedChannelId && channel.deletable) {
      await channel.delete('Reconstrução solicitada por administrador');
      await wait(350);
    }
  }
  const roles = await guild.roles.fetch();
  for (const role of roles.values()) {
    if (role.editable && !role.managed && role.id !== guild.roles.everyone.id) {
      await role.delete('Reconstrução solicitada por administrador');
      await wait(350);
    }
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-servidor')
    .setDescription('Cria uma estrutura de servidor com auxílio de IA.')
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Descreva a comunidade desejada.')
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option.setName('limpar').setDescription('Apagar canais e cargos existentes antes de criar?'),
    )
    .addStringOption((option) =>
      option
        .setName('confirmacao')
        .setDescription('Para limpar, digite exatamente o nome atual do servidor.'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const description = interaction.options.getString('descricao', true);
    const shouldClear = interaction.options.getBoolean('limpar') ?? false;
    const confirmation = interaction.options.getString('confirmacao');
    if (shouldClear && confirmation !== interaction.guild.name) {
      return interaction.reply({
        content: '❌ Para limpar o servidor, informe o nome atual exatamente em `confirmacao`.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const generated = await generateConfiguration(description, interaction.client.services.config);
    const totalChannels = generated.categories.reduce(
      (total, category) => total + category.channels.length,
      0,
    );
    if (totalChannels > 100) throw new Error('A estrutura excede o limite de 100 canais.');

    if (shouldClear) await clearGuild(interaction.guild, interaction.channelId);
    for (const role of generated.roles) {
      await interaction.guild.roles.create({
        name: role.name,
        color: role.color ?? Colors.Default,
        permissions: role.permissions.map((name) => PermissionFlagsBits[name]),
        reason: `Estrutura solicitada por ${interaction.user.tag}`,
      });
      await wait(350);
    }
    for (const categoryData of generated.categories) {
      const category = await interaction.guild.channels.create({
        name: categoryData.name,
        type: ChannelType.GuildCategory,
        reason: `Estrutura solicitada por ${interaction.user.tag}`,
      });
      for (const channel of categoryData.channels) {
        await interaction.guild.channels.create({
          name: channel.name,
          type: channel.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent: category.id,
          reason: `Estrutura solicitada por ${interaction.user.tag}`,
        });
        await wait(350);
      }
    }

    interaction.client.services.logger.audit('Estrutura de guild criada.', {
      actorId: interaction.user.id,
      guildId: interaction.guildId,
      roles: generated.roles.length,
      channels: totalChannels,
      cleared: shouldClear,
    });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('Green')
          .setTitle('✅ Estrutura criada')
          .setDescription(
            `Foram criados ${generated.roles.length} cargos e ${totalChannels} canais.`,
          ),
      ],
    });
  },
};
