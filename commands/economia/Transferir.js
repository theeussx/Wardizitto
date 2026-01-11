const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("transferir")
        .setDescription("Transfira Wardcoins para outro usuário.")
        .addUserOption(option => option.setName("usuario").setDescription("O destinatário.").setRequired(true))
        .addIntegerOption(option => option.setName("quantia").setDescription("A quantia para transferir.").setRequired(true).setMinValue(1)),

    async execute(interaction) {
        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser("usuario");
        const amount = interaction.options.getInteger("quantia");

        if (receiver.id === senderId) return interaction.reply({ content: "❌ Você não pode transferir para si mesmo!", ephemeral: true });
        if (receiver.bot) return interaction.reply({ content: "❌ Você não pode transferir para bots!", ephemeral: true });

        await interaction.deferReply();

        try {
            const senderData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [senderId]))[0];
            
            if (!senderData || senderData.carteira < amount) {
                return interaction.editReply("❌ Você não tem Wardcoins suficientes na carteira!");
            }

            const embedConfirm = new EmbedBuilder()
                .setTitle("💸 Confirmação de Transferência")
                .setDescription(`Você deseja transferir **${amount.toLocaleString()}** Wardcoins para ${receiver}?`)
                .setColor("#F1C40F")
                .setFooter({ text: "Esta ação não pode ser desfeita." });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("confirm_transfer").setLabel("Confirmar").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("cancel_transfer").setLabel("Cancelar").setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.editReply({ embeds: [embedConfirm], components: [row] });

            const filter = i => i.user.id === senderId;
            const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

            collector.on("collect", async i => {
                if (i.customId === "confirm_transfer") {
                    // Re-verificar saldo antes de processar
                    const currentSenderData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [senderId]))[0];
                    if (currentSenderData.carteira < amount) {
                        return i.update({ content: "❌ Saldo insuficiente!", embeds: [], components: [] });
                    }

                    await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [amount, senderId]);
                    await query(
                        "INSERT INTO economia_usuarios (user_id, carteira) VALUES (?, ?) ON DUPLICATE KEY UPDATE carteira = carteira + ?",
                        [receiver.id, amount, amount]
                    );

                    const embedSuccess = new EmbedBuilder()
                        .setTitle("✅ Transferência Concluída")
                        .setDescription(`Você transferiu com sucesso **${amount.toLocaleString()}** Wardcoins para ${receiver}!`)
                        .setColor("#2ECC71")
                        .setTimestamp();

                    await i.update({ embeds: [embedSuccess], components: [] });
                } else {
                    await i.update({ content: "❌ Transferência cancelada.", embeds: [], components: [] });
                }
                collector.stop();
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Erro ao processar transferência.");
        }
    }
};
