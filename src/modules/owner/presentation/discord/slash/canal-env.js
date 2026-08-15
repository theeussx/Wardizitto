const { isOwner } = require('../../../../../core/security/owner.js');
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-mensagem')
    .setDescription('Envie uma mensagem em um servidor e canal selecionado'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: `${emoji('icons_wrong')} Apenas o dono do bot pode usar este comando.`,
        ephemeral: true,
      });
    }

    const guilds = interaction.client.guilds.cache
      .map((guild) => ({
        label: guild.name,
        description: `ID: ${guild.id}`,
        value: guild.id,
      }))
      .slice(0, 25);

    if (guilds.length === 0) {
      return interaction.reply({
        content: `${emoji('icons_wrong')} O bot não está em nenhum servidor.`,
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('selecionar_servidor')
      .setPlaceholder('Selecione um servidor para enviar a mensagem')
      .addOptions(guilds);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const label = new LabelBuilder()
      .setColor(Colors.Blurple)
      .setTitle('Envio de Mensagem')
      .setDescription(`${emoji('icons_message')} Escolha o servidor onde deseja enviar a mensagem.`)
      .setFooter('MightWard Bot');

    await interaction.reply({
      components: [label.build(), row],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
