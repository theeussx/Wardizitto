const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const emojis = require('../../databases/emojis.json');

// Função que gera a string do emoji com base no ID
function getEmoji(name, animated = false) {
    const category = animated ? emojis.animated : emojis.static;
    const id = category?.[name];
    if (!id) {
        console.warn(`[EMOJI] Emoji não encontrado: ${name} (animated: ${animated})`);
        return null;
    }
    const prefix = animated ? 'a' : '';
    return `<${prefix}:${name}:${id}>`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('「Diversão」Joga uma moeda virtual')
        .addStringOption(option =>
            option.setName('aposta')
                .setDescription('Escolha cara ou coroa')
                .setRequired(true)
                .addChoices(
                    { name: 'Cara', value: 'Cara' },
                    { name: 'Coroa', value: 'Coroa' },
                )
        ),

    cooldown: 5,

    async execute(interaction) {
        await interaction.deferReply();

        const coinEmoji = getEmoji('icons_coin') || '🪙';
        const headsEmoji = getEmoji('eg_heads') || '👑';
        const tailsEmoji = getEmoji('eg_tails') || '🐍';
        const spinEmoji = getEmoji('icons_logo', true) || '🔄';
        const winImage = 'https://i.makeagif.com/media/3-21-2021/ncFCLo.gif';
        const loseImage = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmDWGYYxb8BLjFT6exroHjUo2pgEOZRGFc7J7AmcDEp_WW93eYi5ifQSfg&s=10';

        const aposta = interaction.options.getString('aposta');

        await interaction.editReply({ content: `${spinEmoji} Girando moeda...` });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
        const resultEmoji = resultado === 'Cara' ? headsEmoji : tailsEmoji;

        let mensagem, imageUrl;
        if (aposta === resultado) {
            mensagem = `${coinEmoji} **Você ganhou!**\n${resultEmoji} **${resultado}**`;
            imageUrl = winImage;
        } else {
            mensagem = `${coinEmoji} **Você perdeu!**\n${resultEmoji} **${resultado}**`;
            imageUrl = loseImage;
        }

        const embed = new EmbedBuilder()
            .setColor(aposta === resultado ? 0x00FF00 : 0xFF0000)
            .setTitle(`${coinEmoji} Resultado do Coinflip`)
            .setDescription(mensagem)
            .setFooter({ text: `Solicitado por ${interaction.user.username}` })
            .setImage(imageUrl);

        const jogarNovamenteButton = new ButtonBuilder()
            .setCustomId('jogar_novamente')
            .setLabel('Jogar novamente')
            .setStyle(ButtonStyle.Primary);

        const sairButton = new ButtonBuilder()
            .setCustomId('sair')
            .setLabel('Sair')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(jogarNovamenteButton, sairButton);

        await interaction.editReply({
            content: '',
            embeds: [embed],
            components: [row]
        });

        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'jogar_novamente') {
                const apostarEmCaraButton = new ButtonBuilder()
                    .setCustomId('apostar_em_cara')
                    .setLabel('Apostar em Cara')
                    .setStyle(ButtonStyle.Success);

                const apostarEmCoroaButton = new ButtonBuilder()
                    .setCustomId('apostar_em_coroa')
                    .setLabel('Apostar em Coroa')
                    .setStyle(ButtonStyle.Danger);

                const apostaRow = new ActionRowBuilder().addComponents(apostarEmCaraButton, apostarEmCoroaButton);

                await i.update({
                    content: `${spinEmoji} **Escolha sua aposta (Cara ou Coroa):**`,
                    embeds: [],
                    components: [apostaRow]
                });
            } else if (i.customId === 'apostar_em_cara' || i.customId === 'apostar_em_coroa') {
                const apostaEscolhida = i.customId === 'apostar_em_cara' ? 'Cara' : 'Coroa';
                const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
                const resultEmoji = resultado === 'Cara' ? headsEmoji : tailsEmoji;

                let mensagem, imageUrl;
                if (apostaEscolhida === resultado) {
                    mensagem = `${coinEmoji} **Você ganhou!**\n${resultEmoji} **${resultado}**`;
                    imageUrl = winImage;
                } else {
                    mensagem = `${coinEmoji} **Você perdeu!**\n${resultEmoji} **${resultado}**`;
                    imageUrl = loseImage;
                }

                const embed = new EmbedBuilder()
                    .setColor(apostaEscolhida === resultado ? 0x00FF00 : 0xFF0000)
                    .setTitle(`${coinEmoji} Resultado do Coinflip`)
                    .setDescription(mensagem)
                    .setFooter({ text: `Solicitado por ${i.user.username}` })
                    .setImage(imageUrl);

                await i.update({
                    content: '',
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('jogar_novamente')
                                .setLabel('Jogar novamente')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('sair')
                                .setLabel('Sair')
                                .setStyle(ButtonStyle.Danger)
                        )
                    ]
                });
            } else if (i.customId === 'sair') {
                await i.update({
                    content: 'Você saiu do jogo. Até a próxima!',
                    embeds: [],
                    components: []
                });
                collector.stop();
            }
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({
                    content: 'Tempo expirado! Você pode tentar novamente.',
                    embeds: [embed],
                    components: []
                });
            } catch (e) {
                // Ignora erro se a mensagem já foi atualizada
            }
        });
    },
};