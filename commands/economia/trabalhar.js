const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { query } = require("../../handlers/db.js");
const ms = require("ms");
const { checkLevelUp } = require("../../events/economia/LevelUpHandler.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("trabalhar")
        .setDescription("Trabalhe para ganhar Wardcoins."),

    async execute(interaction) {
        const userId = interaction.user.id;
        await interaction.deferReply();

        try {
            const data = (await query("SELECT ultima_trabalhar FROM economia_usuarios WHERE user_id = ?", [userId]))[0];
            const cooldown = 3600000; // 1 hora

            if (data && data.ultima_trabalhar) {
                const lastWork = new Date(data.ultima_trabalhar).getTime();
                if (Date.now() - lastWork < cooldown) {
                    const remaining = cooldown - (Date.now() - lastWork);
                    return interaction.editReply(`⏳ Você está cansado! Volte a trabalhar em **${ms(remaining, { long: true })}**.`);
                }
            }

            const professionData = (await query("SELECT profissao FROM economia_profissoes WHERE user_id = ?", [userId]))[0];
            const profession = professionData ? professionData.profissao : "Desempregado";
            
            // Bônus por profissão (exemplo simples)
            let bonus = 1;
            if (profession !== "Desempregado") bonus = 1.5;

            const reward = Math.floor((Math.random() * (1500 - 500 + 1)) + 500) * bonus;
            const xpGain = Math.floor(Math.random() * 20) + 10;

            await query(
                `UPDATE economia_usuarios 
                 SET carteira = carteira + ?, xp = xp + ?, ultima_trabalhar = CURRENT_TIMESTAMP 
                 WHERE user_id = ?`,
                [reward, xpGain, userId]
            );

            // Verificar Level Up
            await checkLevelUp(userId, interaction);

            const embed = new EmbedBuilder()
                .setTitle("💼 Jornada de Trabalho")
                .setDescription(`Você trabalhou como **${profession}** e recebeu **${reward.toLocaleString()}** Wardcoins!`)
                .addFields({ name: "✨ Experiência", value: `+${xpGain} XP`, inline: true })
                .setColor("#3498DB")
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Erro ao trabalhar.");
        }
    }
};
