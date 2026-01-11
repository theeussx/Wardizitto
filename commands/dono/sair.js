const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const emojis = require('../../databases/emojis.json');
const emojiLeft = `<:icons_leftarrow:${emojis.static.icons_leftarrow}>`;
const emojiRight = `<:icons_rightarrow:${emojis.static.icons_rightarrow}>`;
const emojiLeave = `<:icons_leave:${emojis.static.icons_leave}>`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sair-servidor')
    .setDescription('Seleciona um servidor para o bot sair (apenas o dono).'),

  async execute(interaction) {
    const donoId = '1033922089436053535'; // Substitui isso
    if (interaction.user.id !== donoId) {
      return interaction.reply({ content: 'Você não tem permissão.', ephemeral: true });
    }

    const guilds = interaction.client.guilds.cache.map(g => ({
      label: g.name.length > 100 ? g.name.slice(0, 97) + '...' : g.name,
      value: g.id
    }));

    if (guilds.length === 0) {
      return interaction.reply({ content: 'O bot não está em nenhum servidor.', ephemeral: true });
    }

    let page = 0;
    const perPage = 25;

    const gerarMensagem = (pagina) => {
      const slice = guilds.slice(pagina * perPage, (pagina + 1) * perPage);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`sair_servidor_select`)
        .setPlaceholder('Selecione o servidor')
        .addOptions(slice);

      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior_pagina')
          .setLabel('Anterior')
          .setEmoji(emojiLeft)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pagina === 0),
        new ButtonBuilder()
          .setCustomId('proxima_pagina')
          .setLabel('Próxima')
          .setEmoji(emojiRight)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((pagina + 1) * perPage >= guilds.length)
      );

      return {
        content: `${emojiLeave} **Selecione o servidor que o bot vai sair:**`,
        components: [rowSelect, rowButtons]
      };
    };

    // Armazena estado por usuário
    interaction.client._sairServidor = interaction.client._sairServidor || {};
    interaction.client._sairServidor[interaction.user.id] = {
      guilds,
      page
    };

    const mensagem = gerarMensagem(page);
    await interaction.reply({ ...mensagem, ephemeral: true });
  }
};