const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, emoji } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beijo')
    .setDescription('「Social」Dê um beijo em alguém!')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('O usuário que você quer beijar').setRequired(true),
    ),

  async execute(interaction) {
    const { query } = require('../../../../../infrastructure/database/legacy.js');
    await interaction.deferReply();

    const usuario = interaction.options.getUser('usuario');
    const autor = interaction.user;
    const client = interaction.client;

    if (usuario.bot)
      return interaction.editReply({ content: `${emoji('eg_cross')} Você não pode beijar bots!` });
    if (usuario.id === autor.id)
      return interaction.editReply({
        content: `${emoji('eg_cross')} Você não pode beijar a si mesmo!`,
      });

    // Obter gif de beijo
    let gif;
    try {
      const response = await fetch('https://api.waifu.pics/sfw/kiss', {
        signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
      });
      const data = await response.json();
      gif = data.url;
    } catch (err) {
      interaction.client.services.logger.error('❌ Erro ao buscar gif:', err);
      return interaction.editReply({
        content: `${emoji('eg_cross')} Erro ao buscar o gif de beijo.`,
      });
    }

    // Busca parceiros em paralelo
    let parceiroDoAutor, parceiroDoAlvo;
    try {
      const marriageQuery = `SELECT user_id, parceiro_id FROM casamentos
        WHERE guild_id = ? AND (user_id = ? OR parceiro_id = ?) LIMIT 1`;
      const [autorRes, alvoRes] = await Promise.all([
        query(marriageQuery, [interaction.guildId, autor.id, autor.id]),
        query(marriageQuery, [interaction.guildId, usuario.id, usuario.id]),
      ]);

      const autorMarriage = autorRes[0];
      const alvoMarriage = alvoRes[0];
      parceiroDoAutor = autorMarriage
        ? autorMarriage.user_id === autor.id
          ? autorMarriage.parceiro_id
          : autorMarriage.user_id
        : undefined;
      parceiroDoAlvo = alvoMarriage
        ? alvoMarriage.user_id === usuario.id
          ? alvoMarriage.parceiro_id
          : alvoMarriage.user_id
        : undefined;
    } catch (error) {
      interaction.client.services.logger.error('❌ Erro ao buscar parceiros:', error);
      return interaction.editReply({ content: `${emoji('eg_cross')} Erro ao buscar informações.` });
    }

    const saoCasadosEntreSi = parceiroDoAutor === usuario.id || parceiroDoAlvo === autor.id;

    let title;
    let description;
    let color;
    let footer;
    if (saoCasadosEntreSi) {
      title = `${emoji('eg_star')} AMOR VERDADEIRO! 💍`;
      description =
        `${emoji('icons_verified')} **${autor}** e **${usuario}** selaram seu amor com um beijo apaixonado!\n\n` +
        `${emoji('eg_star')} Casal oficial detectado!\n💍 Que esse relacionamento continue abençoado!`;
      color = 0xff69b4;
      footer = 'Casal abençoado por ErislyBot ✨';
    } else {
      title = `${emoji('eg_heart')} BEIJO ROMÂNTICO!`;
      description =
        `**${autor}** deu um beijo em **${usuario}**! ${emoji('eg_heart')}\n\n` +
        `_Será que isso vai virar um romance?_ ${emoji('icons_heart')}`;
      color = 0xff1493;
      footer = 'Beijos enviados com amor 💖';
    }

    // CORNO 1: autor traiu
    if (parceiroDoAutor && parceiroDoAutor !== usuario.id) {
      try {
        const user = await client.users.fetch(parceiroDoAutor);
        await user.send({
          content: `${emoji('eg_cross')} **ALERTA DE TRAIÇÃO!** ${emoji('eg_cross')}\n\n${emoji('eg_netual')} Seu parceiro(a) **${autor.username}** deu um beijo em **${usuario.username}**!\n💔 Esperamos que seja apenas um mal-entendido...`,
        });
      } catch (err) {
        interaction.client.services.logger.error(
          `❌ Erro ao enviar DM para ${parceiroDoAutor}:`,
          err.message,
        );
      }
      description += `\n\n${emoji('eg_cross')} **${autor.username}** parece estar comprometido(a)... ${emoji('eg_netual')}`;
    }

    // CORNO 2: beijaram seu parceiro
    if (parceiroDoAlvo === autor.id && usuario.id !== autor.id) {
      try {
        const user = await client.users.fetch(autor.id);
        await user.send({
          content: `${emoji('eg_cross')} **ALERTA DE TRAIÇÃO!** ${emoji('eg_cross')}\n\n${emoji('eg_netual')} Seu parceiro(a) **${usuario.username}** recebeu e retribuiu um beijo de **${autor.username}**!\n💔 A confiança está sendo colocada à prova.`,
        });
      } catch (err) {
        interaction.client.services.logger.error(
          `❌ Erro ao enviar DM para ${autor.id}:`,
          err.message,
        );
      }
    }

    const label = new LabelBuilder()
      .setAuthor(autor.username, autor.displayAvatarURL({ dynamic: true }))
      .setTitle(title)
      .setDescription(description)
      .setImage(gif)
      .setColor(color)
      .setFooter(footer)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('retribuir_beijo')
        .setLabel('Retribuir Beijo')
        .setEmoji(emoji('icons_heart'))
        .setStyle(ButtonStyle.Primary),
    );

    const message = await interaction.editReply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });

    const filter = (i) => i.customId === 'retribuir_beijo';
    const collector = message.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (i) => {
      if (i.user.id !== usuario.id) {
        return i.reply({
          content: `${emoji('eg_cross')} Apenas ${usuario} pode retribuir esse beijo!`,
          ephemeral: true,
        });
      }

      let novoGif;
      try {
        const response = await fetch('https://api.waifu.pics/sfw/kiss', {
          signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
        });
        const data = await response.json();
        novoGif = data.url;
      } catch {
        return i.reply({
          content: `${emoji('eg_cross')} Erro ao buscar novo gif.`,
          ephemeral: true,
        });
      }

      let retribuirDescription =
        `**${usuario}** retribuiu o beijo de **${autor}**! ${emoji('eg_heart')}\n\n` +
        `_O romance está florescendo..._ ${emoji('eg_star')}`;

      // CORNO 3: alvo retribuiu, mas é casado com outro
      if (parceiroDoAlvo && parceiroDoAlvo !== autor.id) {
        try {
          const user = await client.users.fetch(parceiroDoAlvo);
          await user.send({
            content: `${emoji('eg_cross')} **TRAIÇÃO CONFIRMADA!** ${emoji('eg_cross')}\n\n${emoji('eg_netual')} Seu parceiro(a) **${usuario.username}** retribuiu um beijo de **${autor.username}**!\n💔 A confiança está sendo colocada à prova.`,
          });
        } catch (err) {
          interaction.client.services.logger.error(
            `❌ Erro ao enviar DM para ${parceiroDoAlvo}:`,
            err.message,
          );
        }
        retribuirDescription += `\n\n${emoji('eg_cross')} **${usuario.username}** parece estar comprometido(a)... ${emoji('eg_netual')}`;
      }

      const retribuirLabel = new LabelBuilder()
        .setTitle(`${emoji('eg_heart')} BEIJO RETRIBUÍDO! ${emoji('icons_heart')}`)
        .setDescription(retribuirDescription)
        .setImage(novoGif)
        .setColor('#FF69B4')
        .setFooter('Beijo retribuído com carinho 💞')
        .setTimestamp();

      await i.update({
        components: [retribuirLabel.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        message
          .edit({ components: [label.build()], flags: MessageFlags.IsComponentsV2 })
          .catch((error) =>
            interaction.client.services.logger.error('Falha ao remover componentes.', error),
          );
      }
    });
  },
};
