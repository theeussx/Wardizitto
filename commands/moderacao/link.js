const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('「Moderação」Envia um link com um botão para redirecionar ao site desejado.')
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('O título da embed.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descricao')
                .setDescription('A descrição da embed.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('url')
                .setDescription('O link para o qual o botão redirecionará.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('botao')
                .setDescription('O texto exibido no botão.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('imagem')
                .setDescription('URL de uma imagem para exibir na embed (opcional).')
                .setRequired(false)),

    async execute(interaction) {
        const ownerId = '1033922089436053535'; // Substitua pelo seu ID do Discord
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
        const isOwner = interaction.user.id === ownerId;

        // Verifica se o usuário tem permissão para moderar o servidor
        if (!isAdmin && !isOwner) {
            return interaction.reply({
                content: '❌ Você precisa ter permissão para **moderar o servidor** para usar este comando.',
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
                content: '❌ A URL da imagem deve ser um link direto para uma imagem (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`).',
                ephemeral: true,
            });
        }

        // Criando a embed personalizada
        const embed = new EmbedBuilder()
            .setColor(0x3498db) // Cor azul
            .setTitle(titulo)
            .setDescription(descricao)
            .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (imagem) embed.setImage(imagem);

        // Criando o botão
        const button = new ButtonBuilder()
            .setLabel(botao)
            .setStyle(ButtonStyle.Link)
            .setURL(url);

        // Criando a linha de botões
        const row = new ActionRowBuilder().addComponents(button);

        // Enviando a mensagem com a embed e o botão
        await interaction.reply({
            embeds: [embed],
            components: [row],
        });
    },
};