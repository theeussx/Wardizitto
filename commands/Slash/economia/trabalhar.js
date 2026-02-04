const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");
const { checkLevelUp } = require("../../../events/economia/LevelUpHandler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("trabalhar")
        .setDescription("💼 Trabalhe para ganhar Wardcoins e XP."),

    async execute(interaction) {
        const userId = interaction.user.id;
        const cooldown = 3600000; // 1 hora

        await interaction.deferReply({ flags: [MessageFlags.IsComponentsV2] });

        try {
            const userData = (await query("SELECT last_work, level FROM economia_usuarios WHERE user_id = ?", [userId]))[0];

            if (userData && userData.last_work && (Date.now() - userData.last_work < cooldown)) {
                const restante = cooldown - (Date.now() - userData.last_work);
                const minutos = Math.ceil(restante / 60000);
                return interaction.editReply({ content: `⏳ Você já trabalhou recentemente! Volte em **${minutos} minutos**.` });
            }

            const ganhoBase = Math.floor(Math.random() * 300) + 200;
            const xpGain = Math.floor(Math.random() * 30) + 20;
            
            await query(
                "UPDATE economia_usuarios SET carteira = carteira + ?, xp = xp + ?, last_work = ? WHERE user_id = ?",
                [ganhoBase.toString(), xpGain, Date.now(), userId]
            );

            await checkLevelUp(userId, interaction);

            const container = new ContainerBuilder()
                .setAccentColor(0x3498DB)
                .addTextDisplayComponents(t => t.setContent(`## 💼 Jornada de Trabalho Concluída`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `Você trabalhou duro hoje e recebeu sua recompensa!\n\n**Salário:** \`+${ganhoBase.toLocaleString()}\` 🪙\n**XP:** \`+${xpGain}\` ⭐`
                ));

            const mainRow = new ActionRowBuilder().addComponents(container);
            await interaction.editReply({ components: [mainRow] });

        } catch (error) {
            console.error("Erro ao trabalhar:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao processar seu trabalho." });
        }
    }
};
