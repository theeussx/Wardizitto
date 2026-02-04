const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("📅 Resgate sua recompensa diária de Wardcoins."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const cooldown = 86400000; // 24 horas

        await interaction.deferReply({ flags: [MessageFlags.IsComponentsV2] });

        try {
            const userData = (await query("SELECT last_daily FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (userData && userData.last_daily && (Date.now() - userData.last_daily < cooldown)) {
                const restante = cooldown - (Date.now() - userData.last_daily);
                const horas = Math.floor(restante / 3600000);
                const minutos = Math.floor((restante % 3600000) / 60000);
                return interaction.editReply({ content: `⏳ Você já resgatou seu prêmio hoje! Volte em **${horas}h ${minutos}m**.` });
            }

            const recompensa = 1500;
            await query("UPDATE economia_usuarios SET carteira = carteira + ?, last_daily = ? WHERE user_id = ?", [recompensa.toString(), Date.now(), userId]);

            const container = new ContainerBuilder()
                .setAccentColor(0x9B59B6)
                .addTextDisplayComponents(t => t.setContent(`## 📅 Recompensa Diária Resgatada`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `Parabéns! Você recebeu suas Wardcoins diárias.\n\n**Prêmio:** \`+${recompensa.toLocaleString()}\` 🪙\n\n> *Dica: Em breve você poderá resgatar bônus exclusivos em nosso site!*`
                ));

            const mainRow = new ActionRowBuilder().addComponents(container);
            await interaction.editReply({ components: [mainRow] });

        } catch (error) {
            console.error("Erro no Daily:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao resgatar sua recompensa." });
        }
    }
};
