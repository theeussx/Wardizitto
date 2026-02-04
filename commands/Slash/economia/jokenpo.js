const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");
const { checkLevelUp } = require("../../../events/economia/LevelUpHandler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jokenpo")
        .setDescription("✊✋✌️ Jogue Pedra, Papel ou Tesoura contra o bot valendo Wardcoins.")
        .addIntegerOption(option => 
            option.setName("aposta")
                .setDescription("Quantia de Wardcoins para apostar.")
                .setRequired(true)
                .setMinValue(50)
        )
        .addStringOption(option =>
            option.setName("escolha")
                .setDescription("Sua jogada.")
                .setRequired(true)
                .addChoices(
                    { name: "Pedra ✊", value: "pedra" },
                    { name: "Papel ✋", value: "papel" },
                    { name: "Tesoura ✌️", value: "tesoura" }
                )
        ),

    async execute(interaction) {
        const aposta = interaction.options.getInteger("aposta");
        const escolhaUsuario = interaction.options.getString("escolha");
        const userId = interaction.user.id;

        await interaction.deferReply({ flags: [MessageFlags.IsComponentsV2] });

        try {
            const userData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (!userData || BigInt(userData.carteira) < BigInt(aposta)) {
                return interaction.editReply({ content: `❌ Você não tem **${aposta.toLocaleString()}** Wardcoins na carteira!` });
            }

            const opcoes = ["pedra", "papel", "tesoura"];
            const emojis = { pedra: "✊", papel: "✋", tesoura: "✌️" };
            const escolhaBot = opcoes[Math.floor(Math.random() * opcoes.length)];

            let resultado = ""; // "vitoria", "derrota", "empate"
            if (escolhaUsuario === escolhaBot) {
                resultado = "empate";
            } else if (
                (escolhaUsuario === "pedra" && escolhaBot === "tesoura") ||
                (escolhaUsuario === "papel" && escolhaBot === "pedra") ||
                (escolhaUsuario === "tesoura" && escolhaBot === "papel")
            ) {
                resultado = "vitoria";
            } else {
                resultado = "derrota";
            }

            const container = new ContainerBuilder()
                .setAccentColor(resultado === "vitoria" ? 0x2ECC71 : (resultado === "derrota" ? 0xE74C3C : 0xF1C40F))
                .addTextDisplayComponents(t => t.setContent(`## ✊✋✌️ Jokenpô: ${resultado.toUpperCase()}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `**Você:** ${emojis[escolhaUsuario]} \`${escolhaUsuario.toUpperCase()}\`\n**Wardizitto:** ${emojis[escolhaBot]} \`${escolhaBot.toUpperCase()}\``
                ));

            if (resultado === "vitoria") {
                const lucro = BigInt(aposta);
                const xpGain = Math.floor(Math.random() * 20) + 10;
                await query("UPDATE economia_usuarios SET carteira = carteira + ?, xp = xp + ? WHERE user_id = ?", [lucro.toString(), xpGain, userId]);
                await checkLevelUp(userId, interaction);
                container.addTextDisplayComponents(t => t.setContent(`### 🎉 Você venceu!\n**Ganhou:** \`+${aposta.toLocaleString()}\` 🪙\n**XP:** \`+${xpGain}\` ⭐`));
            } else if (resultado === "derrota") {
                await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [aposta.toString(), userId]);
                container.addTextDisplayComponents(t => t.setContent(`### 😢 Você perdeu...\n**Perdeu:** \`-${aposta.toLocaleString()}\` 🪙`));
            } else {
                container.addTextDisplayComponents(t => t.setContent(`### 🤝 Empate!\nSuas Wardcoins foram devolvidas.`));
            }

            const mainRow = new ActionRowBuilder().addComponents(container);
            await interaction.editReply({ components: [mainRow] });

        } catch (error) {
            console.error("Erro no Jokenpo:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao processar o jogo." });
        }
    }
};
