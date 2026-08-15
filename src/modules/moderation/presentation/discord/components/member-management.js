const { MessageFlags, PermissionFlagsBits, TextInputStyle } = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const {
  LabelBuilder,
  Colors,
  createModal,
} = require('../../../../../presentation/discord/ui/components-v2.js');

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });
const canModerate = (interaction) =>
  interaction.memberPermissions?.any([
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageMessages,
  ]);

const durationMs = (value) => {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+)(m|h|d)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const multiplier = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  const duration = amount * multiplier;
  return duration > 0 && duration <= 28 * 86_400_000 ? duration : undefined;
};

const assertTarget = async (interaction, userId) => {
  const target = await interaction.guild.members.fetch(userId).catch(() => undefined);
  if (!target || target.user.bot || target.id === interaction.user.id) return undefined;
  if (
    interaction.guild.ownerId !== interaction.user.id &&
    target.roles.highest.position >= interaction.member.roles.highest.position
  ) {
    return undefined;
  }
  return target;
};

module.exports = {
  async execute(interaction) {
    if (!interaction.inGuild() || !canModerate(interaction)) {
      return interaction.reply(ephemeral('❌ Você não possui permissão de moderação.'));
    }

    if (interaction.isButton()) {
      const match = interaction.customId.match(
        /^adminAction_(timeout|warn|viewwarns|clearwarns|kick|ban)_(\d{17,20})$/,
      );
      if (!match) return;
      const [, action, userId] = match;
      const target = await assertTarget(interaction, userId);
      if (!target)
        return interaction.reply(ephemeral('❌ Este membro não pode ser moderado por você.'));

      if (action === 'viewwarns') {
        const warnings = await query(
          `SELECT moderator_id, reason, date FROM warns
            WHERE guild_id = ? AND user_id = ? ORDER BY date DESC LIMIT 10`,
          [interaction.guildId, userId],
        );
        const description = warnings.length
          ? warnings
              .map(
                (warning, index) =>
                  `**${index + 1}.** ${String(warning.reason).slice(0, 300)} · <@${warning.moderator_id}> · <t:${Math.floor(new Date(warning.date).getTime() / 1000)}:R>`,
              )
              .join('\n')
          : 'Nenhuma advertência registrada.';
        const label = new LabelBuilder()
          .setTitle(`Advertências de ${target.user.tag}`)
          .setDescription(description)
          .setColor(Colors.Orange);
        return interaction.reply({
          components: [label.build()],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      if (action === 'clearwarns') {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply(ephemeral('❌ É necessário Gerenciar Mensagens.'));
        }
        const result = await query('DELETE FROM warns WHERE guild_id = ? AND user_id = ?', [
          interaction.guildId,
          userId,
        ]);
        return interaction.reply(
          ephemeral(`✅ ${result.affectedRows} advertência(s) removida(s).`),
        );
      }

      const fields = [];
      if (action === 'timeout') {
        fields.push({
          customId: 'duration',
          label: 'Duração: 10m, 2h ou 7d (máximo 28d)',
          style: TextInputStyle.Short,
          maxLength: 10,
          required: true,
        });
      }
      fields.push({
        customId: 'reason',
        label: 'Motivo',
        style: TextInputStyle.Paragraph,
        maxLength: 512,
        required: true,
      });

      const modal = createModal({
        customId: `adminAction_modal_${action}_${userId}`,
        title:
          action === 'warn'
            ? 'Registrar advertência'
            : action === 'timeout'
              ? 'Aplicar castigo'
              : action === 'kick'
                ? 'Expulsar membro'
                : 'Banir membro',
        fields,
      });
      return interaction.showModal(modal);
    }

    if (!interaction.isModalSubmit()) return;
    const match = interaction.customId.match(
      /^adminAction_modal_(timeout|warn|kick|ban)_(\d{17,20})$/,
    );
    if (!match) return;
    const [, action, userId] = match;
    const target = await assertTarget(interaction, userId);
    if (!target)
      return interaction.reply(ephemeral('❌ Este membro não pode ser moderado por você.'));
    const reason = interaction.fields.getTextInputValue('reason').trim();

    if (action === 'warn') {
      await query(
        'INSERT INTO warns (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
        [interaction.guildId, userId, interaction.user.id, reason],
      );
    } else if (action === 'timeout') {
      const duration = durationMs(interaction.fields.getTextInputValue('duration'));
      if (!duration) return interaction.reply(ephemeral('❌ Duração inválida. Use até 28d.'));
      if (!target.moderatable)
        return interaction.reply(ephemeral('❌ O bot não pode castigar este membro.'));
      await target.timeout(duration, `${reason} · por ${interaction.user.tag}`);
    } else if (action === 'kick') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers) || !target.kickable) {
        return interaction.reply(ephemeral('❌ Sem permissão para expulsar este membro.'));
      }
      await target.kick(`${reason} · por ${interaction.user.tag}`);
    } else {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers) || !target.bannable) {
        return interaction.reply(ephemeral('❌ Sem permissão para banir este membro.'));
      }
      await target.ban({ reason: `${reason} · por ${interaction.user.tag}` });
    }

    interaction.client.services.logger.audit('Ação de moderação executada.', {
      guildId: interaction.guildId,
      actorId: interaction.user.id,
      targetId: userId,
      action,
      reason,
    });
    return interaction.reply(ephemeral('✅ Ação de moderação concluída.'));
  },
};
