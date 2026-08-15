const { isOwner } = require('../../../../../core/security/owner.js');
const {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('「Moderação」Envia um link com um botão para redirecionar ao site desejado.')
    .addStringOption((option) =>
      option.setName('titulo').setDescription('O título da embed.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('descricao').setDescription('A descrição da embed.').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('O link para o qual o botão redirecionará.')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('botao').setDescription('O texto exibido no botão.').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('imagem')
        .setDescription('URL de uma imagem para exibir na embed (opcional).')
        .setRequired(false),
    ),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const owner = isOwner(interaction.user.id);

    // Verifica se o usuário tem permissão para moderar o servidor
    if (!isAdmin && !owner) {
      return interaction.reply({
        content:
          '❌ Você precisa ter permissão para **moderar o servidor** para usar este comando.',
        ephemeral: true,
      });
    }

    const titulo = interaction.options.getString('titulo');
    const descricao = interaction.options.getString('descricao');
    const url = interaction.options.getString('url');
    const botao = interaction.options.getString('botao');
    const imagem = interaction.options.getString('imagem');

    // Verifica se o link começa com http:// ou https://
    if (!/^https?:\/\//.test(url)) {
      return interaction.reply({
        content: '❌ O link deve começar com `http://` ou `https://`.',
        ephemeral: true,
      });
    }

    // Verifica se a imagem é um link válido
    if (imagem && !/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)$/i.test(imagem)) {
      return interaction.reply({
        content:
          '❌ A URL da imagem deve ser um link direto para uma imagem (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`).',
        ephemeral: true,
      });
    }

    // Criando o rótulo personalizado
    const label = new LabelBuilder()
      .setColor(Colors.Blue)
      .setTitle(titulo)
      .setDescription(descricao)
      .setFooter(`Solicitado por ${interaction.user.tag}`)
      .setTimestamp();

    if (imagem) label.setImage(imagem);

    // Criando o botão
    const button = new ButtonBuilder().setLabel(botao).setStyle(ButtonStyle.Link).setURL(url);

    // Criando a linha de botões
    const row = new ActionRowBuilder().addComponents(button);

    // Enviando a mensagem com o rótulo e o botão
    await interaction.reply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
