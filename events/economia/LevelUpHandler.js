const { EmbedBuilder } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    async checkLevelUp(userId, message) {
        try {
            const userData = (await query("SELECT xp, level FROM economia_usuarios WHERE user_id = ?", [userId]))[0];
            if (!userData) return;

            const nextLevelXp = userData.level * 500; // Fórmula simples: Nível * 500 XP para o próximo nível

            if (userData.xp >= nextLevelXp) {
                const newLevel = userData.level + 1;
                const reward = newLevel * 1000; // Recompensa em Wardcoins por subir de nível

                await query(
                    "UPDATE economia_usuarios SET level = ?, xp = xp - ?, carteira = carteira + ? WHERE user_id = ?",
                    [newLevel, nextLevelXp, reward, userId]
                );

                const embed = new EmbedBuilder()
                    .setTitle("🆙 Level Up!")
                    .setDescription(`Parabéns <@${userId}>! Você subiu para o **Nível ${newLevel}**!\n🎁 Recompensa: **${reward.toLocaleString()}** Wardcoins.`)
                    .setColor("#9B59B6")
                    .setThumbnail("https://cdn.discordapp.com/emojis/1353597390673936448.png")
                    .setTimestamp();

                if (message.channel) {
                    await message.channel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error("Erro ao verificar Level Up:", error);
        }
    }
};
