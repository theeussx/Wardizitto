const { ContainerBuilder, ActionRowBuilder, SeparatorBuilder } = require("discord.js");

module.exports = {
    name: "kick",
    description: "👢 Expulsa um membro do servidor.",
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
            
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(t => t.setContent(`## 👢 Membro Expulso`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `**Usuário:** ${target.user.tag} (\`${target.id}\`)\n**Moderador:** ${message.author.tag}\n**Razão:** ${reason}`
                ));

            const mainRow = new ActionRowBuilder().addComponents(container);
            message.reply({ components: [mainRow] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao tentar expulsar o membro.");
        }
    }
};
