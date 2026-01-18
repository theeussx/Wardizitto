const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "kick",
    description: "Expulsa um membro do servidor.",
    run: async (client, message, args) => {
        if (!message.member.permissions.has("KickMembers")) {
            return message.reply("❌ Você não tem permissão para expulsar membros.");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("❌ Mencione o usuário que deseja expulsar.");
        
        if (!target.kickable) return message.reply("❌ Eu não posso expulsar este usuário (cargo superior ao meu).");

        const reason = args.slice(1).join(" ") || "Nenhuma razão fornecida.";

        try {
            await target.kick(reason);
            
            const embed = new EmbedBuilder()
                .setTitle("👢 Membro Expulso")
                .addFields(
                    { name: "👤 Usuário", value: `${target.user.tag}`, inline: true },
                    { name: "🛡️ Moderador", value: `${message.author.tag}`, inline: true },
                    { name: "📝 Razão", value: reason }
                )
                .setColor("#E67E22")
                .setTimestamp();

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao tentar expulsar o membro.");
        }
    }
};
