const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casar')
    .setDescription('Proponha casamento a outro membro do servidor.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Pessoa que receberá o pedido.').setRequired(true),
    ),

  async execute(interaction) {
    const proposer = interaction.user;
    const target = interaction.options.getUser('usuario', true);
    if (target.bot || proposer.id === target.id) {
      return interaction.reply({
        content: '❌ Escolha outra pessoa que não seja um bot.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const marriages = interaction.client.services.marriages;
    if (
      (await marriages.find(interaction.guildId, proposer.id)) ||
      (await marriages.find(interaction.guildId, target.id))
    ) {
      return interaction.reply({
        content: '❌ Uma das pessoas já está casada neste servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const customId = `accept_marriage_${proposer.id}_${target.id}`;
    const response = await interaction.reply({
      content: `${target}`,
      embeds: [
        new EmbedBuilder()
          .setTitle('💍 Pedido de casamento')
          .setDescription(`${proposer} quer se casar com ${target}.`)
          .setColor('Purple'),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Aceitar')
            .setStyle(ButtonStyle.Success),
        ),
      ],
      withResponse: true,
    });
    const message = response.resource?.message;
    if (!message) throw new Error('Mensagem do pedido não foi criada.');
    const acceptance = await message
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (button) => button.customId === customId && button.user.id === target.id,
        time: 60_000,
      })
      .catch(() => undefined);
    if (!acceptance) {
      await interaction.editReply({ content: 'O pedido expirou.', embeds: [], components: [] });
      return;
    }

    await marriages.marry(interaction.guildId, proposer.id, target.id);
    await acceptance.update({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle('💜 Casamento realizado')
          .setDescription(`${proposer} e ${target} agora estão casados neste servidor.`)
          .setColor('Green'),
      ],
      components: [],
    });
  },
};
