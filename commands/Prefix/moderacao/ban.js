const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "ban",
    description: "Bane um membro do servidor.",
    run: async (client, message, args) => {
        if (!message.member.permissions.has("BanMembers")) {
            return message.reply("❌ Você não tem permissão para banir membros.");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("❌ Mencione o usuário que deseja banir.");
        
        if (!target.bannable) return message.reply("❌ Eu não posso banir este usuário (cargo superior ao meu).");

        const reason = args.slice(1).join(" ") || "Nenhuma razão fornecida.";

        try {
            await target.ban({ reason });
            
            const embed = new EmbedBuilder()
                .setTitle("🔨 Membro Banido")
                .addFields(
                    { name: "👤 Usuário", value: `${target.user.tag}`, inline: true },
                    { name: "🛡️ Moderador", value: `${message.author.tag}`, inline: true },
                    { name: "📝 Razão", value: reason }
                )
                .setColor("#E74C3C")
                .setTimestamp();

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao tentar banir o membro.");
        }
    }
};
