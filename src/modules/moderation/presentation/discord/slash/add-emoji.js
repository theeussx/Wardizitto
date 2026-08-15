const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

const ephemeralLabel = (description) =>
  new LabelBuilder().setColor(Colors.Red).setDescription(description);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-emoji')
    .setDescription('Adiciona um emoji ao servidor')
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome do novo emoji (somente letras, números e underline).')
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option.setName('imagem').setDescription('Imagem para o novo emoji.').setRequired(true),
    ),
  async execute(interaction) {
    const nome = interaction.options.getString('nome');
    const imagem = interaction.options.getAttachment('imagem');

    const sendEphemeral = (label) =>
      interaction.reply({
        components: [label.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

    // Verificação de permissão do membro
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
      return sendEphemeral(
        ephemeralLabel(
          `${emoji('eg_cross')} **Permissão insuficiente!**\nVocê precisa da permissão \`Gerenciar Emojis e Figurinhas\` para usar \`/add-emoji\`.`,
        ),
      );
    }

    // Verificação de permissão do bot
    if (
      !interaction.guild.members.me.permissions.has(
        PermissionsBitField.Flags.ManageEmojisAndStickers,
      )
    ) {
      return sendEphemeral(
        ephemeralLabel(
          `${emoji('eg_cross')} **Permissão insuficiente (BOT)!**\nO bot precisa da permissão \`Gerenciar Emojis e Figurinhas\` para executar essa ação.`,
        ),
      );
    }

    // Verificação do nome do emoji
    const nomeValido = /^[\w]{2,32}$/.test(nome);
    if (!nomeValido) {
      return sendEphemeral(
        ephemeralLabel(
          `${emoji('eg_cross')} **Nome inválido!**\nUse apenas letras, números e underline (\`_\`). Máximo 32 caracteres.`,
        ),
      );
    }

    // Verificação de duplicidade de nome
    const jaExiste = interaction.guild.emojis.cache.find((e) => e.name === nome);
    if (jaExiste) {
      return sendEphemeral(
        ephemeralLabel(
          `${emoji('eg_cross')} Já existe um emoji com o nome \`${nome}\` neste servidor.`,
        ),
      );
    }

    // Verificação se o arquivo é uma imagem
    if (!imagem.contentType?.startsWith('image/')) {
      return sendEphemeral(
        ephemeralLabel(
          `${emoji('eg_cross')} **Imagem inválida!**\nPor favor, envie um arquivo de imagem válido.`,
        ),
      );
    }

    try {
      const emojiCriado = await interaction.guild.emojis.create({
        attachment: imagem.url,
        name: nome,
        reason: `Emoji adicionado por ${interaction.user.tag} via comando /add-emoji.`,
      });

      const label = new LabelBuilder()
        .setColor(Colors.Green)
        .setTitle(`${emoji('icons_correct')} Emoji adicionado com sucesso!`)
        .setDescription(`O emoji ${emojiCriado} foi adicionado ao servidor com o nome \`${nome}\`.`)
        .setThumbnail(imagem.url)
        .setFooter(`Comando executado por ${interaction.user.tag}`);

      return interaction.reply({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      interaction.client.services.logger.error('Erro em handler de compatibilidade.', error);
      const label = new LabelBuilder()
        .setColor(Colors.Red)
        .setTitle(`${emoji('eg_cross')} Erro ao adicionar emoji`)
        .setDescription(
          'O servidor pode ter atingido o limite de emojis ou ocorreu um erro inesperado.',
        )
        .setFooter('Erro no comando /add-emoji');

      return interaction.reply({
        components: [label.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
