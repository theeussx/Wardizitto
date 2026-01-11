const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-emoji')
        .setDescription('Adiciona um emoji ao servidor')
        .addStringOption(option =>
            option
                .setName('nome')
                .setDescription('Nome do novo emoji (somente letras, números e underline).')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('imagem')
                .setDescription('Imagem para o novo emoji.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const nome = interaction.options.getString('nome');
        const imagem = interaction.options.getAttachment('imagem');

        // Verificação de permissão do membro
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> **Permissão insuficiente!**\nVocê precisa da permissão `Gerenciar Emojis e Figurinhas` para usar `/add-emoji`.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Verificação de permissão do bot
        if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> **Permissão insuficiente (BOT)!**\nO bot precisa da permissão `Gerenciar Emojis e Figurinhas` para executar essa ação.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Verificação do nome do emoji
        const nomeValido = /^[\w]{2,32}$/.test(nome);
        if (!nomeValido) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> **Nome inválido!**\nUse apenas letras, números e underline (`_`). Máximo 32 caracteres.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Verificação de duplicidade de nome
        const jaExiste = interaction.guild.emojis.cache.find(e => e.name === nome);
        if (jaExiste) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`<:eg_cross:1353597108640415754> Já existe um emoji com o nome \`${nome}\` neste servidor.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Verificação se o arquivo é uma imagem
        if (!imagem.contentType?.startsWith('image/')) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> **Imagem inválida!**\nPor favor, envie um arquivo de imagem válido.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            const emoji = await interaction.guild.emojis.create({
                attachment: imagem.url,
                name: nome,
                reason: `Emoji adicionado por ${interaction.user.tag} via comando /add-emoji.`
            });

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('<:icons_correct:1353597185542979664> Emoji adicionado com sucesso!')
                .setDescription(`O emoji ${emoji} foi adicionado ao servidor com o nome \`${nome}\`.`)
                .setThumbnail(imagem.url)
                .setFooter({ text: `Comando executado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('<:eg_cross:1353597108640415754> Erro ao adicionar emoji')
                .setDescription('O servidor pode ter atingido o limite de emojis ou ocorreu um erro inesperado.')
                .setFooter({ text: 'Erro no comando /add-emoji', iconURL: interaction.client.user.displayAvatarURL() });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};