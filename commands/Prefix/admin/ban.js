const { EmbedBuilder, ContainerBuilder, ActionRowBuilder, SeparatorBuilder } = require("discord.js");

module.exports = {
    name: "ban",
    description: "🔨 Bane um membro do servidor.",
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
            
            const container = new ContainerBuilder()
                .setAccentColor(0xE74C3C)
                .addTextDisplayComponents(t => t.setContent(`## 🔨 Membro Banido`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `**Usuário:** ${target.user.tag} (\`${target.id}\`)\n**Moderador:** ${message.author.tag}\n**Razão:** ${reason}`
                ));

            const mainRow = new ActionRowBuilder().addComponents(container);
            message.reply({ components: [mainRow] });
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao tentar banir o membro.");
        }
    }
};
