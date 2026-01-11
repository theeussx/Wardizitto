const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const ownerId = '1033922089436053535';
const { static: emojis } = require('../../databases/emojis.json'); // Ajuste o caminho conforme a estrutura do seu projeto

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-mensagem')
    .setDescription('Envie uma mensagem em um servidor e canal selecionado'),

  async execute(interaction) {
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: `<:icons_wrong:${emojis.icons_wrong}> Apenas o dono do bot pode usar este comando.`,
        ephemeral: true
      });
    }

    const guilds = interaction.client.guilds.cache.map(guild => ({
      label: guild.name,
      description: `ID: ${guild.id}`,
      value: guild.id
    })).slice(0, 25);

    if (guilds.length === 0) {
      return interaction.reply({
        content: `<:icons_wrong:${emojis.icons_wrong}> O bot não está em nenhum servidor.`,
        ephemeral: true
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selecionar_servidor')
      .setPlaceholder('Selecione um servidor para enviar a mensagem')
      .addOptions(guilds);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Envio de Mensagem')
      .setDescription(`<:icons_message:${emojis.icons_message}> Escolha o servidor onde deseja enviar a mensagem.`)
      .setFooter({ text: 'MightWard Bot', iconURL: interaction.client.user.displayAvatarURL() });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};