const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infor-emoji')
        .setDescription('「Utilidades」Exibe informações detalhadas sobre um emoji.')
        .addStringOption(option =>
            option
                .setName('emoji')
                .setDescription('Digite o emoji ou o ID do emoji.')
                .setRequired(true)
        ),
    async execute(interaction) {
        const headerEmoji = '<:eg_emojis:1353597114017648821>';
        const emojiInput = interaction.options.getString('emoji');
        const emojiRegex = /<a?:\w+:(\d+)>/;
        const match = emojiInput.match(emojiRegex);

        if (match) {
            // Emoji customizado
            const emojiID = match[1];
            const emoji = interaction.client.emojis.cache.get(emojiID);

            if (!emoji) {
                return interaction.reply({ content: 'Não consegui encontrar este emoji no cache.', ephemeral: true });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Abrir emoji no navegador')
                        .setURL(emoji.url)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setCustomId('emoji_info')
                        .setLabel('Ver informações')
                        .setStyle(ButtonStyle.Primary)
                );

            const message = await interaction.reply({
                embeds: [
                    {
                        color: 0x0099ff,
                        title: `${headerEmoji} Informações do Emoji`,
                        image: { url: emoji.url }
                    }
                ],
                components: [row],
                fetchReply: true
            });

            // Gerenciar interação com botões
            const filter = i => i.customId === 'emoji_info' && i.user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ filter, time: 120000 }); // 2 minutos

            collector.on('collect', async i => {
                if (i.customId === 'emoji_info') {
                    await i.update({
                        embeds: [
                            {
                                color: 0x0099ff,
                                title: `${headerEmoji} Informações do Emoji`,
                                fields: [
                                    { name: 'Nome', value: emoji.name, inline: true },
                                    { name: 'ID', value: emoji.id, inline: true },
                                    { name: 'Animado', value: emoji.animated ? 'Sim' : 'Não', inline: true },
                                    { name: 'Criado em', value: `<t:${Math.floor(emoji.createdTimestamp / 1000)}:F>`, inline: true },
                                    { name: 'URL', value: `[Clique aqui](${emoji.url})`, inline: true }
                                ],
                                thumbnail: { url: emoji.url }
                            }
                        ],
                        components: []
                    });
                }
            });

            collector.on('end', async () => {
                // Após 2 minutos, edita a mensagem para remover os botões
                if (message.editable) {
                    await interaction.editReply({
                        components: [],
                        content: '⏳ O tempo para interagir acabou! Use o comando novamente para ver as informações.'
                    });
                }
            });
        } else if (/^\p{Emoji}$/u.test(emojiInput)) {
            // Emoji padrão
            return interaction.reply({
                embeds: [
                    {
                        color: 0x0099ff,
                        title: `${headerEmoji} Informações do Emoji`,
                        fields: [
                            { name: 'Emoji', value: emojiInput, inline: true },
                            { name: 'Código Unicode', value: emojiInput.codePointAt(0).toString(16).toUpperCase(), inline: true }
                        ]
                    }
                ]
            });
        } else {
            return interaction.reply({ content: 'O valor fornecido não é um emoji válido.', ephemeral: true });
        }
    }
};