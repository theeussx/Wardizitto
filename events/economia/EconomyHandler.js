const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    async execute(interaction) {
        const { customId, user, guild, member } = interaction;

        // --- COMPRA DE ITENS ---
        if (interaction.isStringSelectMenu() && customId === "buy_item_select") {
            await interaction.deferReply({ ephemeral: true });
            const itemId = interaction.values[0];

            try {
                const item = (await query("SELECT * FROM economia_loja WHERE id = ?", [itemId]))[0];
                const userData = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [user.id]))[0];

                if (!item) return interaction.editReply("❌ Item não encontrado.");
                if (!userData || userData.carteira < item.preco) {
                    return interaction.editReply(`❌ Você não tem Wardcoins suficientes! Faltam **${(item.preco - (userData?.carteira || 0)).toLocaleString()}** 🪙.`);
                }

                // Processar compra
                await query("UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?", [item.preco, user.id]);
                await query(
                    "INSERT INTO economia_inventario (user_id, guild_id, item_id, quantidade) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE quantidade = quantidade + 1",
                    [user.id, guild.id, item.id]
                );

                const embed = new EmbedBuilder()
                    .setTitle("✅ Compra Realizada!")
                    .setDescription(`Você comprou **${item.item_nome}** por **${item.preco.toLocaleString()}** Wardcoins!`)
                    .setColor("#2ECC71")
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply("❌ Erro ao processar a compra.");
            }
        }

        // --- DEPÓSITO E SAQUE RÁPIDO ---
        if (interaction.isButton()) {
            if (customId === "deposit_all") {
                const data = (await query("SELECT carteira FROM economia_usuarios WHERE user_id = ?", [user.id]))[0];
                if (!data || data.carteira <= 0) return interaction.reply({ content: "❌ Você não tem nada para depositar!", ephemeral: true });

                await query("UPDATE economia_usuarios SET banco = banco + carteira, carteira = 0 WHERE user_id = ?", [user.id]);
                await interaction.reply({ content: "✅ Tudo depositado com sucesso!", ephemeral: true });
            }

            if (customId === "withdraw_all") {
                const data = (await query("SELECT banco FROM economia_usuarios WHERE user_id = ?", [user.id]))[0];
                if (!data || data.banco <= 0) return interaction.reply({ content: "❌ Você não tem nada para sacar!", ephemeral: true });

                await query("UPDATE economia_usuarios SET carteira = carteira + banco, banco = 0 WHERE user_id = ?", [user.id]);
                await interaction.reply({ content: "✅ Tudo sacado com sucesso!", ephemeral: true });
            }

            // Inventário no Perfil
            if (customId.startsWith("inventory_")) {
                const targetId = customId.split("_")[1];
                const items = await query(
                    "SELECT l.item_nome, i.quantidade FROM economia_inventario i JOIN economia_loja l ON i.item_id = l.id WHERE i.user_id = ?",
                    [targetId]
                );

                const embed = new EmbedBuilder()
                    .setTitle(`🎒 Inventário de ${user.username}`)
                    .setColor("#9B59B6");

                if (items.length === 0) {
                    embed.setDescription("Este usuário não possui itens no inventário.");
                } else {
                    embed.setDescription(items.map(i => `**${i.item_nome}** x${i.quantidade}`).join("\n"));
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Insígnias no Perfil
            if (customId.startsWith("badges_")) {
                const targetId = customId.split("_")[1];
                const userData = (await query("SELECT level, carteira, banco FROM economia_usuarios WHERE user_id = ?", [targetId]))[0];
                
                const embed = new EmbedBuilder()
                    .setTitle(`🏅 Insígnias de ${user.username}`)
                    .setColor("#F1C40F")
                    .setDescription("Aqui estão as conquistas e insígnias deste usuário:");

                const badges = [];
                if (userData) {
                    if (userData.level >= 10) badges.push("⭐ **Nível 10+**: Veterano");
                    if (userData.level >= 50) badges.push("🏆 **Nível 50+**: Mestre");
                    if ((userData.carteira + userData.banco) >= 1000000) badges.push("💎 **Milionário**: Possui mais de 1M de Wardcoins");
                }

                if (badges.length === 0) {
                    embed.setDescription("Este usuário ainda não possui insígnias. Continue jogando para conquistar!");
                } else {
                    embed.addFields({ name: "Conquistas", value: badges.join("\n") });
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};