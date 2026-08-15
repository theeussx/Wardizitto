const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('「Administração」Inicia um sorteio no canal atual')
    .addStringOption((option) =>
      option
        .setName('duração')
        .setDescription('Duração do sorteio (ex: 1m, 1h, 1d)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('prêmio').setDescription('O prêmio do sorteio').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('vencedores').setDescription('Número de vencedores').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const duração = interaction.options.getString('duração');
    const prêmio = interaction.options.getString('prêmio');
    const vencedores = interaction.options.getInteger('vencedores');

    // Converter duração para milissegundos
    const durationMs = this.parseDuration(duração);
    if (!durationMs) {
      return interaction.reply({
        content: `${emoji('icons_wrong')} **Duração inválida!** Use um formato como \`1m\`, \`1h\`, \`1d\`.`,
        ephemeral: true,
      });
    }

    // Criar rótulo do sorteio
    const endTime = Date.now() + durationMs;
    const label = new LabelBuilder()
      .setColor(0xffd700) // Dourado para sorteio
      .setTitle(`${emoji('eg_gift')} **Sorteio Iniciado!**`)
      .setDescription(
        `🎁 **Prêmio:** ${prêmio}\n🏆 **Vencedores:** ${vencedores}\n⏰ **Termina em:** <t:${Math.floor(endTime / 1000)}:R>`,
      )
      .setFooter(`Sorteio criado por ${interaction.user.username}`);

    // Botões de participação e visualização
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participar')
        .setLabel('Participar')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emoji('eg_gift')),
      new ButtonBuilder()
        .setCustomId('ver_participantes')
        .setLabel('Ver Participantes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji('icons_people')),
    );

    const sorteioMessage = await interaction.channel.send({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply({
      content: `${emoji('icons_correct')} **Sorteio iniciado com sucesso!**`,
      ephemeral: true,
    });

    // Coletar participantes
    const participantes = new Set();
    const collector = sorteioMessage.createMessageComponentCollector({ time: durationMs });

    collector.on('collect', async (i) => {
      if (i.customId === 'participar') {
        if (!participantes.has(i.user.id)) {
          participantes.add(i.user.id);
          await i.reply({
            content: `${emoji('icons_correct')} Você entrou no sorteio! Boa sorte! 🍀`,
            ephemeral: true,
          });
        } else {
          await i.reply({
            content: `${emoji('icons_warning')} Você já está participando!`,
            ephemeral: true,
          });
        }
      } else if (i.customId === 'ver_participantes') {
        if (participantes.size === 0) {
          await i.reply({
            content: `${emoji('icons_warning')} Nenhum participante ainda.`,
            ephemeral: true,
          });
        } else {
          const listaParticipantes = Array.from(participantes)
            .map((id) => `<@${id}>`)
            .join('\n');
          await i.reply({
            content: `${emoji('icons_people')} **Participantes (${participantes.size}):**\n${listaParticipantes}`,
            ephemeral: true,
          });
        }
      }
    });

    // Finalizar sorteio
    collector.on('end', async () => {
      try {
        const participantesArray = Array.from(participantes);

        if (participantesArray.length === 0) {
          await interaction.channel.send({
            content: `${emoji('icons_wrong')} O sorteio terminou, mas ninguém participou.`,
          });
          return;
        }

        // Selecionar vencedores
        const ganhadores = [];
        for (let i = 0; i < vencedores; i++) {
          if (participantesArray.length === 0) break;
          const randomIndex = Math.floor(Math.random() * participantesArray.length);
          const vencedor = participantesArray.splice(randomIndex, 1)[0];
          ganhadores.push(vencedor);
        }

        const vencedoresMention = ganhadores.map((id) => `<@${id}>`).join(', ');
        const finalLabel = new LabelBuilder()
          .setColor(Colors.Green)
          .setTitle(`${emoji('eg_gift')} **Sorteio Encerrado!**`)
          .setDescription(
            `🎁 **Prêmio:** ${prêmio}\n🏆 **Vencedores:** ${vencedoresMention}\n🎉 **Parabéns aos vencedores!**`,
          )
          .setFooter(`Sorteio realizado por ${interaction.user.username}`);

        await interaction.channel.send({
          components: [finalLabel.build()],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        interaction.client.services.logger.error('Erro ao finalizar o sorteio:', error);
        await interaction.channel.send({
          content: `${emoji('icons_wrong')} **Erro ao finalizar o sorteio!**`,
        });
      }
    });
  },

  // Função para converter duração em milissegundos
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return null;
    }
  },
};
