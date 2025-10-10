const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const ownerId = '1033922089436053535'; // Substitua com seu ID

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convite-servidor')
    .setDescription('Mostra os servidores do bot e permite gerar convite para um deles'),

  async execute(interaction) {
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: 'Apenas o dono do bot pode usar este comando.',
        ephemeral: true
      });
    }

    const guilds = interaction.client.guilds.cache.map(g => ({ name: g.name, id: g.id }));
    if (!guilds.length) {
      return interaction.reply({ content: 'O bot não está em nenhum servidor.', ephemeral: true });
    }

    let page = 0;
    const perPage = 25;
    const totalPages = Math.ceil(guilds.length / perPage);

    const getPageOptions = (page) => {
      return guilds
        .slice(page * perPage, (page + 1) * perPage)
        .map(g => ({
          label: g.name.slice(0, 100),
          value: g.id
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
          .setDisabled(page === totalPages - 1)
      );
    };

    const embed = new EmbedBuilder()
      .setTitle(`Servidores do Bot — Página ${page + 1}/${totalPages}`)
      .setDescription('Selecione um servidor abaixo para gerar um convite.')
      .setColor('Blue');

    const rowSelect = new ActionRowBuilder().addComponents(createSelectMenu(page));
    const rowButtons = createButtons();

    await interaction.reply({
      embeds: [embed],
      components: [rowSelect, rowButtons],
      ephemeral: true
    });

    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'Você não pode interagir com isso.', ephemeral: true });
      }

      if (i.isButton()) {
        if (i.customId === 'anterior') page--;
        else if (i.customId === 'proxima') page++;

        const newEmbed = EmbedBuilder.from(embed).setTitle(`Servidores do Bot — Página ${page + 1}/${totalPages}`);
        const newSelectRow = new ActionRowBuilder().addComponents(createSelectMenu(page));
        const newButtonsRow = createButtons();

        return i.update({
          embeds: [newEmbed],
          components: [newSelectRow, newButtonsRow]
        });

      } else if (i.isStringSelectMenu()) {
        const guildId = i.values[0];
        const guild = interaction.client.guilds.cache.get(guildId);

        if (!guild) {
          return i.update({ content: 'Servidor não encontrado.', components: [], embeds: [] });
        }

        try {
          const channels = guild.channels.cache.filter(c =>
            c.isTextBased() &&
            c.permissionsFor(guild.members.me).has('CreateInstantInvite')
          );
          const channel = channels.first();

          if (!channel) {
            return i.update({
              content: 'Nenhum canal com permissão para criar convite foi encontrado.',
              components: [],
              embeds: []
            });
          }

          const invite = await channel.createInvite({ maxAge: 0, unique: true });
          return i.update({
            content: `Convite para **${guild.name}**: ${invite.url}`,
            components: [],
            embeds: []
          });
        } catch (err) {
          console.error(err);
          return i.update({
            content: 'Erro ao gerar convite.',
            components: [],
            embeds: []
          });
        }
      }
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  }
};