const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

function getEmoji(name) {
  const emojis = {
    gift: '<:icons_gift:1353597120761958462>',
    correct: '<:icons_correct:1353597444918607882>',
    wrong: '<:icons_wrong:1353597152218619985>',
    warning: '<:icons_warning:1353597114017648821>',
    people: '<:icons_people:1353597189414457429>',
  };
  return emojis[name] || '🎉';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription(`「Administração」Inicia um sorteio no canal atual`)
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
        content: `${getEmoji('wrong')} **Duração inválida!** Use um formato como \`1m\`, \`1h\`, \`1d\`.`,
        ephemeral: true,
      });
    }

    // Criar embed do sorteio
    const endTime = Date.now() + durationMs;
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Dourado para sorteio
      .setTitle(`${getEmoji('gift')} **Sorteio Iniciado!**`)
      .setDescription(
        `🎁 **Prêmio:** ${prêmio}\n🏆 **Vencedores:** ${vencedores}\n⏰ **Termina em:** <t:${Math.floor(endTime / 1000)}:R>`,
      )
      .setFooter({ text: `Sorteio criado por ${interaction.user.username}` });

    // Botões de participação e visualização
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participar')
        .setLabel('Participar')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(getEmoji('gift')),
      new ButtonBuilder()
        .setCustomId('ver_participantes')
        .setLabel('Ver Participantes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getEmoji('people')),
    );

    const sorteioMessage = await interaction.channel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({
      content: `${getEmoji('correct')} **Sorteio iniciado com sucesso!**`,
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
            content: `${getEmoji('correct')} Você entrou no sorteio! Boa sorte! 🍀`,
            ephemeral: true,
          });
        } else {
          await i.reply({
            content: `${getEmoji('warning')} Você já está participando!`,
            ephemeral: true,
          });
        }
      } else if (i.customId === 'ver_participantes') {
        if (participantes.size === 0) {
          await i.reply({
            content: `${getEmoji('warning')} Nenhum participante ainda.`,
            ephemeral: true,
          });
        } else {
          const listaParticipantes = Array.from(participantes)
            .map((id) => `<@${id}>`)
            .join('\n');
          await i.reply({
            content: `${getEmoji('people')} **Participantes (${participantes.size}):**\n${listaParticipantes}`,
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
            content: `${getEmoji('wrong')} O sorteio terminou, mas ninguém participou.`,
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
        const embedFinal = new EmbedBuilder()
          .setColor(0x00ff00) // Verde para sucesso
          .setTitle(`${getEmoji('gift')} **Sorteio Encerrado!**`)
          .setDescription(
            `🎁 **Prêmio:** ${prêmio}\n🏆 **Vencedores:** ${vencedoresMention}\n🎉 **Parabéns aos vencedores!**`,
          )
          .setFooter({ text: `Sorteio realizado por ${interaction.user.username}` });

        await interaction.channel.send({
          content: `🎉 **Parabéns aos vencedores!** ${vencedoresMention}`,
          embeds: [embedFinal],
        });
      } catch (error) {
        interaction.client.services.logger.error('Erro ao finalizar o sorteio:', error);
        await interaction.channel.send({
          content: `${getEmoji('wrong')} **Erro ao finalizar o sorteio!**`,
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
