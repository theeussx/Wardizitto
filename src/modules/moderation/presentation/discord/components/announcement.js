const {
  Events,
  TextInputStyle,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
} = require('discord.js');
const {
  LabelBuilder,
  Colors,
  createModal,
} = require('../../../../../presentation/discord/ui/components-v2.js');

// Extrai título, descrição, cor e mídia de um container V2 serializado.
const parsePreview = (message) => {
  const container = message?.components?.[0]?.toJSON?.() ?? message?.components?.[0];
  const texts = [];
  let color = '#5865F2';
  let imageUrl = '';
  let thumbUrl = '';
  const walk = (node) => {
    if (!node) return;
    if (node.type === 10) texts.push(node.content);
    if (node.accent_color !== undefined) {
      color = `#${node.accent_color.toString(16).padStart(6, '0')}`;
    }
    if (node.type === 12 && node.items?.[0]?.media?.url) imageUrl = node.items[0].media.url;
    if (node.accessory?.media?.url) thumbUrl = node.accessory.media.url;
    for (const child of node.components || []) walk(child);
    for (const item of node.items || []) walk(item);
  };
  walk(container);
  const title = (texts.find((text) => text.startsWith('## ')) || '')
    .replace(/^##\s*/u, '')
    .replace('📢 ', '');
  const description =
    texts.find((text) => !text.startsWith('## ') && !text.startsWith('-# ')) || '';
  return { title, description, color, imageUrl, thumbUrl };
};

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // Verificar se é um botão, modal ou select menu
    if (
      !interaction.isButton() &&
      !interaction.isModalSubmit() &&
      !interaction.isChannelSelectMenu()
    )
      return;

    // Verificar permissões do usuário
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para usar esta função.',
        ephemeral: true,
      });
    }

    // Cancelar comunicado
    if (interaction.customId === 'cancelar_comunicado') {
      try {
        await interaction.message.delete();
        await interaction.reply({
          content: 'Comunicado cancelado com sucesso.',
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: 'Ocorreu um erro ao cancelar o comunicado.',
          ephemeral: true,
        });
      }
      return;
    }

    // Editar comunicado - Abrir modal
    if (interaction.customId === 'editar_comunicado') {
      const preview = parsePreview(interaction.message);

      const modal = createModal({
        customId: 'modal_editar_comunicado',
        title: 'Editar Comunicado',
        fields: [
          {
            customId: 'titulo_comunicado',
            label: 'Título',
            style: TextInputStyle.Short,
            value: preview.title || '',
            required: true,
          },
          {
            customId: 'mensagem_comunicado',
            label: 'Descrição',
            style: TextInputStyle.Paragraph,
            value: preview.description || '',
            required: true,
          },
          {
            customId: 'cor_comunicado',
            label: 'Cor (hex ou nome básico)',
            style: TextInputStyle.Short,
            value: preview.color || '#5865F2',
            required: false,
          },
          {
            customId: 'imagem_comunicado',
            label: 'URL da imagem (opcional)',
            style: TextInputStyle.Short,
            value: preview.imageUrl || '',
            required: false,
          },
          {
            customId: 'thumb_comunicado',
            label: 'URL da thumbnail (opcional)',
            style: TextInputStyle.Short,
            value: preview.thumbUrl || '',
            required: false,
          },
        ],
      });

      await interaction.showModal(modal);
      return;
    }

    // Processar modal de edição
    if (interaction.customId === 'modal_editar_comunicado') {
      await interaction.deferUpdate();

      const titulo = interaction.fields.getTextInputValue('titulo_comunicado');
      const mensagem = interaction.fields.getTextInputValue('mensagem_comunicado');
      let cor = interaction.fields.getTextInputValue('cor_comunicado') || '#5865F2';

      // Padronizar cor
      cor = cor.startsWith('#') ? cor : `#${cor}`;

      const label = new LabelBuilder()
        .setTitle(`📢 ${titulo}`)
        .setDescription(mensagem)
        .setColor(cor)
        .setTimestamp()
        .setFooter(`Enviado por ${interaction.user.tag}`);

      // Adicionar imagem e thumbnail se fornecidas e válidas
      const imagem = interaction.fields.getTextInputValue('imagem_comunicado');
      const thumb = interaction.fields.getTextInputValue('thumb_comunicado');

      if (imagem && this.isValidURL(imagem)) label.setImage(imagem);
      if (thumb && this.isValidURL(thumb)) label.setThumbnail(thumb);

      // Recriar os botões de ação
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('editar_comunicado')
          .setLabel('✏️ Editar Embed')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('enviar_comunicado')
          .setLabel('📤 Enviar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelar_comunicado')
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.editReply({
        components: [label.build(), row],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // Enviar comunicado - Selecionar canal
    if (interaction.customId === 'enviar_comunicado') {
      const select = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('canal_destino_comunicado')
          .setPlaceholder('Selecione o canal para enviar')
          .setChannelTypes(0), // apenas canais de texto
      );

      await interaction.reply({
        content: '📍 Selecione o canal onde deseja enviar o comunicado:',
        components: [select],
        ephemeral: true,
      });
      return;
    }

    // Processar seleção do canal
    if (interaction.customId === 'canal_destino_comunicado') {
      await interaction.deferUpdate();

      const canalId = interaction.values[0];

      // Buscar a mensagem original que contém o comunicado
      const originalMessage = await interaction.channel.messages
        .fetch(interaction.message.reference?.messageId)
        .catch(() => undefined);

      const preview = parsePreview(originalMessage);
      if (!originalMessage || !preview.description) {
        return interaction.editReply({
          content: '❌ Não foi possível encontrar o comunicado para enviar.',
          components: [],
        });
      }

      const label = new LabelBuilder()
        .setTitle(`📢 ${preview.title || 'Comunicado'}`)
        .setDescription(preview.description)
        .setColor(preview.color)
        .setTimestamp();
      if (preview.imageUrl) label.setImage(preview.imageUrl);
      if (preview.thumbUrl) label.setThumbnail(preview.thumbUrl);

      try {
        const canal = await interaction.guild.channels.fetch(canalId);

        // Verificar permissões do bot
        if (
          !canal.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.SendMessages)
        ) {
          return interaction.editReply({
            content: `❌ Não tenho permissão para enviar mensagens em ${canal.toString()}`,
            components: [],
          });
        }

        // Enviar o comunicado
        await canal.send({
          components: [label.build()],
          flags: MessageFlags.IsComponentsV2,
        });

        // Atualizar a mensagem de seleção
        await interaction.editReply({
          content: `✅ Comunicado enviado com sucesso para ${canal.toString()}!`,
          components: [],
        });

        // Deletar a mensagem original com os botões
        await originalMessage.delete().catch(() => {});
      } catch (error) {
        interaction.client.services.logger.error('Erro ao enviar comunicado.', error);
        await interaction.editReply({
          content: '❌ Ocorreu um erro ao enviar o comunicado.',
          components: [],
        });
      }
    }
  },

  // Função auxiliar para validar URLs
  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  },
};
