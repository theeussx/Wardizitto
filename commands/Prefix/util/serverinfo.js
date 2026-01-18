const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "serverinfo",
    description: "Mostra informações detalhadas do servidor.",
    run: async (client, message, args) => {
        const guild = message.guild;
        const owner = await guild.fetchOwner();

        const embed = new EmbedBuilder()
            .setTitle(`🏰 Informações do Servidor: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
            .setColor("#5865F2")
            .addFields(
                { name: "👑 Dono", value: `${owner.user.tag}`, inline: true },
                { name: "🆔 ID", value: `\`${guild.id}\``, inline: true },
                { name: "📅 Criado em", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "👥 Membros", value: `\`${guild.memberCount}\` membros`, inline: true },
                { name: "💬 Canais", value: `\`${guild.channels.cache.size}\` canais`, inline: true },
                { name: "🎭 Cargos", value: `\`${guild.roles.cache.size}\` cargos`, inline: true },
                { name: "🚀 Boosts", value: `Nível \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount} boosts)`, inline: true }
            )
            .setFooter({ text: `Requisitado por ${message.author.username}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};
