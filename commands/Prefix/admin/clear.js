const { ContainerBuilder, ActionRowBuilder } = require("discord.js");

module.exports = {
    name: "clear",
    description: "🧹 Limpa mensagens do canal.",
    run: async (client, message, args) => {
        if (!message.member.permissions.has("ManageMessages")) {
            return message.reply("❌ Você não tem permissão para usar este comando.");
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("❌ Informe uma quantia entre **1 e 100**.");
        }

        try {
            await message.channel.bulkDelete(amount + 1, true);
            
            const container = new ContainerBuilder()
                .setAccentColor(0x2ECC71)
                .addTextDisplayComponents(t => t.setContent(`✅ Limpei **${amount}** mensagens com sucesso!`));

            const mainRow = new ActionRowBuilder().addComponents(container);
            const msg = await message.channel.send({ components: [mainRow] });
            setTimeout(() => msg.delete().catch(() => null), 5000);
        } catch (error) {
            console.error(error);
            message.reply("❌ Ocorreu um erro ao tentar limpar as mensagens.");
        }
    }
};
