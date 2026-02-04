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
        .setName("apostar")
        .setDescription("🎰 Aposte suas Wardcoins em um jogo de Cara ou Coroa.")
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

        // Flags para suporte a Componentes V2
        await interaction.deferReply({ flags: [MessageFlags.IsComponentsV2] });

        try {
            const userData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (!userData || BigInt(userData.carteira) < BigInt(quantia)) {
                return interaction.editReply({ content: `❌ Você não tem **${quantia.toLocaleString()}** Wardcoins na carteira para apostar!` });
            }

            const resultado = Math.random() < 0.5 ? "cara" : "coroa";
            const ganhou = escolha === resultado;

            const container = new ContainerBuilder()
                .setAccentColor(ganhou ? 0x2ECC71 : 0xE74C3C)
                .addTextDisplayComponents(t => t.setContent(`## 🎰 Resultado: ${resultado.toUpperCase()}`));

            if (ganhou) {
                const lucro = BigInt(quantia);
                const xpGain = Math.floor(Math.random() * 15) + 5;
                
                await query(
                    "UPDATE economia_usuarios SET carteira = carteira + ?, xp = xp + ? WHERE user_id = ?",
                    [lucro.toString(), xpGain, userId]
                );

                await checkLevelUp(userId, interaction);

                container.addTextDisplayComponents(t => t.setContent(
                    `### 🎉 Parabéns!\nVocê escolheu **${escolha.toUpperCase()}** e ganhou!\n\n**Lucro:** \`+${quantia.toLocaleString()}\` 🪙\n**XP:** \`+${xpGain}\` ⭐`
                ));
            } else {
                await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [quantia.toString(), userId]);

                container.addTextDisplayComponents(t => t.setContent(
                    `### 😢 Que pena...\nVocê escolheu **${escolha.toUpperCase()}**, mas deu **${resultado.toUpperCase()}**.\n\n**Perda:** \`-${quantia.toLocaleString()}\` 🪙`
                ));
            }

            const mainRow = new ActionRowBuilder().addComponents(container);
            
            await interaction.editReply({ components: [mainRow] });

        } catch (error) {
            console.error("Erro ao apostar:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao processar sua aposta." });
        }
    }
};
