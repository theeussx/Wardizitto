const { isOwner } = require('../../../../../core/security/owner.js');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convite-servidor')
    .setDescription('Mostra os servidores do bot e permite gerar convite para um deles'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: 'Apenas o dono do bot pode usar este comando.',
        ephemeral: true,
      });
    }

    const guilds = interaction.client.guilds.cache.map((g) => ({ name: g.name, id: g.id }));
    if (!guilds.length) {
      return interaction.reply({ content: 'O bot não está em nenhum servidor.', ephemeral: true });
    }

    let page = 0;
    const perPage = 25;
    const totalPages = Math.ceil(guilds.length / perPage);

    const getPageOptions = (page) => {
      return guilds.slice(page * perPage, (page + 1) * perPage).map((g) => ({
        label: g.name.slice(0, 100),
        value: g.id,
      }));
    };

    const createSelectMenu = (page) => {
      return new StringSelectMenuBuilder()
        .setCustomId(`select_guild_page_${page}`)
        .setPlaceholder('Selecione um servidor')
        .addOptions(getPageOptions(page));
    };

    const createButtons = () => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior')
          .setLabel('Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('proxima')
          .setLabel('Próxima')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages - 1),
      );
    };

    const buildLabel = (page) =>
      new LabelBuilder()
        .setTitle(`Servidores do Bot — Página ${page + 1}/${totalPages}`)
        .setDescription('Selecione um servidor abaixo para gerar um convite.')
        .setColor('Blue');

    const rowSelect = new ActionRowBuilder().addComponents(createSelectMenu(page));
    const rowButtons = createButtons();

    await interaction.reply({
      components: [buildLabel(page).build(), rowSelect, rowButtons],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'Você não pode interagir com isso.', ephemeral: true });
      }

      if (i.isButton()) {
        if (i.customId === 'anterior') page--;
        else if (i.customId === 'proxima') page++;

        const newSelectRow = new ActionRowBuilder().addComponents(createSelectMenu(page));
        const newButtonsRow = createButtons();

        return i.update({
          components: [buildLabel(page).build(), newSelectRow, newButtonsRow],
          flags: MessageFlags.IsComponentsV2,
        });
      } else if (i.isStringSelectMenu()) {
        const guildId = i.values[0];
        const guild = interaction.client.guilds.cache.get(guildId);

        if (!guild) {
          return i.update({ content: 'Servidor não encontrado.', components: [] });
        }

        try {
          const channels = guild.channels.cache.filter(
            (c) => c.isTextBased() && c.permissionsFor(guild.members.me).has('CreateInstantInvite'),
          );
          const channel = channels.first();

          if (!channel) {
            return i.update({
              content: 'Nenhum canal com permissão para criar convite foi encontrado.',
              components: [],
            });
          }

          const invite = await channel.createInvite({ maxAge: 0, unique: true });
          return i.update({
            content: `Convite para **${guild.name}**: ${invite.url}`,
            components: [],
          });
        } catch (err) {
          interaction.client.services.logger.error('Erro em handler de compatibilidade.', err);
          return i.update({
            content: 'Erro ao gerar convite.',
            components: [],
          });
        }
      }
    });

    collector.on('end', () => {
      msg
        .edit({
          components: [buildLabel(page).build()],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    });
  },
};
