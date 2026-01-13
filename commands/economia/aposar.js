const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");
const { checkLevelUp } = require("../../events/economia/LevelUpHandler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("apostar")
        .setDescription("Aposte suas Wardcoins em um jogo de Cara ou Coroa.")
        .addIntegerOption(option => 
            option.setName("quantia")
                .setDescription("A quantia para apostar.")
                .setRequired(true)
                .setMinValue(100)
        )
        .addStringOption(option =>
            option.setName("escolha")
                .setDescription("Escolha Cara ou Coroa.")
                .setRequired(true)
                .addChoices(
                    { name: "Cara", value: "cara" },
                    { name: "Coroa", value: "coroa" }
                )
        ),

    async execute(interaction) {
        const quantia = interaction.options.getInteger("quantia");
        const escolha = interaction.options.getString("escolha");
        const userId = interaction.user.id;

        await interaction.deferReply();

        try {
            const userData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (!userData || userData.carteira < quantia) {
                return interaction.editReply(`❌ Você não tem **${quantia.toLocaleString()}** Wardcoins na carteira para apostar!`);
            }

            const resultado = Math.random() < 0.5 ? "cara" : "coroa";
            const ganhou = escolha === resultado;

            if (ganhou) {
                const lucro = quantia; // Dobra o valor (ganha o que apostou)
                const xpGain = Math.floor(Math.random() * 15) + 5;
                
                await query(
                    "UPDATE economia_usuarios SET carteira = carteira + ?, xp = xp + ? WHERE user_id = ?",
                    [lucro, xpGain, userId]
                );

                // Verificar Level Up
                await checkLevelUp(userId, interaction);

                const embedWin = new EmbedBuilder()
                    .setTitle("🎉 Você Ganhou!")
                    .setDescription(`O resultado foi **${resultado.toUpperCase()}**!\nVocê ganhou **${lucro.toLocaleString()}** Wardcoins e **${xpGain}** XP.`)
                    .setColor("#2ECC71")
                    .setThumbnail("https://cdn.discordapp.com/emojis/1353597230195408917.png")
                    .setTimestamp();

                await interaction.editReply({ embeds: [embedWin] });
            } else {
                await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [quantia, userId]);

                const embedLoss = new EmbedBuilder()
                    .setTitle("😢 Você Perdeu!")
                    .setDescription(`O resultado foi **${resultado.toUpperCase()}**.\nVocê perdeu **${quantia.toLocaleString()}** Wardcoins. Mais sorte na próxima!`)
                    .setColor("#E74C3C")
                    .setTimestamp();

                await interaction.editReply({ embeds: [embedLoss] });
            }

        } catch (error) {
            console.error("Erro ao apostar:", error);
            await interaction.editReply("❌ Ocorreu um erro ao processar sua aposta.");
        }
    }
};
