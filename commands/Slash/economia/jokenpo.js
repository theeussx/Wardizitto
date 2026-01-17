const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");
const { checkLevelUp } = require("../../events/economia/LevelUpHandler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jokenpo")
        .setDescription("Jogue Pedra, Papel ou Tesoura valendo Wardcoins.")
        .addIntegerOption(option => 
            option.setName("aposta")
                .setDescription("A quantia para apostar.")
                .setRequired(true)
                .setMinValue(50)
        ),

    async execute(interaction) {
        const aposta = interaction.options.getInteger("aposta");
        const userId = interaction.user.id;

        await interaction.deferReply();

        try {
            const userData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (!userData || userData.carteira < aposta) {
                return interaction.editReply(`❌ Você não tem **${aposta.toLocaleString()}** Wardcoins para apostar!`);
            }

            const embed = new EmbedBuilder()
                .setTitle("✊ Pedra, Papel ou Tesoura ✌️")
                .setDescription(`Você apostou **${aposta.toLocaleString()}** Wardcoins.\nEscolha sua jogada abaixo!`)
                .setColor("#3498DB");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("jokenpo_pedra").setLabel("Pedra").setEmoji("✊").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("jokenpo_papel").setLabel("Papel").setEmoji("✋").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("jokenpo_tesoura").setLabel("Tesoura").setEmoji("✌️").setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.editReply({ embeds: [embed], components: [row] });

            const filter = i => i.user.id === userId;
            const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

            collector.on("collect", async i => {
                const escolhas = ["pedra", "papel", "tesoura"];
                const botEscolha = escolhas[Math.floor(Math.random() * escolhas.length)];
                const userEscolha = i.customId.replace("jokenpo_", "");

                let resultado; // 0: Empate, 1: Vitória, 2: Derrota
                if (userEscolha === botEscolha) resultado = 0;
                else if (
                    (userEscolha === "pedra" && botEscolha === "tesoura") ||
                    (userEscolha === "papel" && botEscolha === "pedra") ||
                    (userEscolha === "tesoura" && botEscolha === "papel")
                ) resultado = 1;
                else resultado = 2;

                const emojis = { pedra: "✊", papel: "✋", tesoura: "✌️" };
                const embedResult = new EmbedBuilder()
                    .setTitle("🎮 Resultado do Jokenpô")
                    .addFields(
                        { name: "Sua Escolha", value: `${emojis[userEscolha]} ${userEscolha.toUpperCase()}`, inline: true },
                        { name: "Minha Escolha", value: `${emojis[botEscolha]} ${botEscolha.toUpperCase()}`, inline: true }
                    )
                    .setTimestamp();

                if (resultado === 0) {
                    embedResult.setDescription("🤝 **Empate!** Ninguém perdeu Wardcoins.").setColor("#95A5A6");
                } else if (resultado === 1) {
                    const xpGain = Math.floor(Math.random() * 20) + 10;
                    await query("UPDATE economia_usuarios SET carteira = carteira + ?, xp = xp + ? WHERE user_id = ?", [aposta, xpGain, userId]);
                    
                    // Verificar Level Up
                    await checkLevelUp(userId, i);

                    embedResult.setDescription(`🎉 **Você Venceu!**\nGanhou **${aposta.toLocaleString()}** Wardcoins e **${xpGain}** XP.`).setColor("#2ECC71");
                } else {
                    await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [aposta, userId]);
                    embedResult.setDescription(`😢 **Você Perdeu!**\nPerdeu **${aposta.toLocaleString()}** Wardcoins.`).setColor("#E74C3C");
                }

                await i.update({ embeds: [embedResult], components: [] });
                collector.stop();
            });

            collector.on("end", (collected, reason) => {
                if (reason === "time") {
                    interaction.editReply({ content: "⏰ Tempo esgotado! O jogo foi cancelado.", embeds: [], components: [] });
                }
            });

        } catch (error) {
            console.error("Erro no jokenpo:", error);
            await interaction.editReply("❌ Ocorreu um erro ao processar o jogo.");
        }
    }
};
