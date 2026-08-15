const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  TextInputStyle,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const {
  LabelBuilder,
  Colors,
  createModal,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'canalenv',

  async execute(interaction) {
    try {
      // ▼ SELECT MENU: Seleção de servidor
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'selecionar_servidor') {
          const selectedGuildId = interaction.values[0];
          const guild = interaction.client.guilds.cache.get(selectedGuildId);

          if (!guild) {
            const label = new LabelBuilder()
              .setColor(Colors.Red)
              .setDescription(`${emoji('icons_wrong')} **Servidor não encontrado.**`);
            return interaction.update({
              components: [label.build()],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          const canaisTexto = guild.channels.cache
            .filter((c) => c.type === ChannelType.GuildText && c.viewable)
            .map((c) => ({ label: c.name, value: `${guild.id}-${c.id}` }))
            .slice(0, 25);

          if (canaisTexto.length === 0) {
            const label = new LabelBuilder()
              .setColor('Yellow')
              .setDescription(
                `${emoji('icons_warning')} **Nenhum canal de texto disponível neste servidor.**`,
              );
            return interaction.update({
              components: [label.build()],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          const canalSelect = new StringSelectMenuBuilder()
            .setCustomId('selecionar_canal_destino')
            .setPlaceholder('Selecione um canal...')
            .addOptions(canaisTexto);

          const row = new ActionRowBuilder().addComponents(canalSelect);

          const label = new LabelBuilder()
            .setColor(Colors.Blue)
            .setDescription(
              `${emoji('icons_channel')} Servidor selecionado: **${guild.name}**\nAgora escolha o canal:`,
            );

          return interaction.update({
            components: [label.build(), row],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        // ▼ SELECT MENU: Seleção de canal
        if (interaction.customId === 'selecionar_canal_destino') {
          const [guildId, channelId] = interaction.values[0].split('-');
          const guild = interaction.client.guilds.cache.get(guildId);
          const canal = guild?.channels.cache.get(channelId);

          if (!canal || !canal.viewable || canal.type !== ChannelType.GuildText) {
            const label = new LabelBuilder()
              .setColor(Colors.Red)
              .setDescription(`${emoji('icons_wrong')} **Canal inválido ou inacessível.**`);
            return interaction.update({
              components: [label.build()],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          const modal = createModal({
            customId: `enviar_mensagem_modal-${guildId}-${channelId}`, // Usando hífens para melhor parse
            title: 'Mensagem Personalizada',
            fields: [
              {
                customId: 'mensagem_conteudo',
                label: 'Escreva a mensagem que será enviada',
                style: TextInputStyle.Paragraph,
                maxLength: 2000,
                required: true,
              },
            ],
          });

          return interaction.showModal(modal);
        }
      }

      // ▼ MODAL SUBMIT
      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith('enviar_mensagem_modal-')
      ) {
        const [, guildId, channelId] = interaction.customId.split('-');
        const guild = interaction.client.guilds.cache.get(guildId);
        const canal = guild?.channels.cache.get(channelId);

        if (!canal || !canal.viewable || canal.type !== ChannelType.GuildText) {
          const label = new LabelBuilder()
            .setColor(Colors.Red)
            .setDescription(
              `${emoji('icons_wrong')} **Não foi possível encontrar o canal selecionado.**`,
            );
          return interaction.reply({
            components: [label.build()],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
        }

        const conteudo = interaction.fields.getTextInputValue('mensagem_conteudo');

        await canal.send({ content: conteudo });

        const label = new LabelBuilder()
          .setColor(Colors.Green)
          .setDescription(
            `${emoji('icons_correct')} **Mensagem enviada com sucesso em**\n**${guild.name}** → **#${canal.name}**.`,
          );

        await interaction.reply({
          components: [label.build()],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
    } catch (error) {
      interaction.client.services.logger.error('Erro no canalenv.js:', error);

      const errorLabel = new LabelBuilder()
        .setColor(Colors.Red)
        .setDescription(`${emoji('icons_wrong')} **Ocorreu um erro inesperado.**`);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          components: [errorLabel.build()],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      } else {
        await interaction.reply({
          components: [errorLabel.build()],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
    }
  },
};
