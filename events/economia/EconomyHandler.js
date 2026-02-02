const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    async execute(interaction) {
        const { customId, user } = interaction;

        // 1. ABRIR O MODAL DE GERENCIAMENTO BANCÁRIO
        if (interaction.isButton() && customId === "atm_manage") {
            const modal = new ModalBuilder().setCustomId("modal_atm").setTitle("🏦 Banco Wardizitto");

            const actionInput = new TextInputBuilder()
                .setCustomId("atm_action")
                .setLabel("O que deseja fazer?")
                .setPlaceholder("Digite: depositar ou sacar")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const valInput = new TextInputBuilder()
                .setCustomId("atm_val")
                .setLabel("Qual o valor?")
                .setPlaceholder("Ex: 5000 ou tudo")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(actionInput),
                new ActionRowBuilder().addComponents(valInput)
            );

            return await interaction.showModal(modal);
        }

        // 2. PROCESSAR O ENVIO DO MODAL
        if (interaction.isModalSubmit() && customId === "modal_atm") {
            await interaction.deferReply({ ephemeral: true });

            const action = interaction.fields.getTextInputValue("atm_action").toLowerCase();
            const valRaw = interaction.fields.getTextInputValue("atm_val").toLowerCase();

            const results = await query("SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?", [user.id]);
            const data = results[0];

            if (!data) return interaction.editReply("❌ Conta não encontrada.");

            let quantia;
            const carteira = BigInt(data.carteira);
            const banco = BigInt(data.banco);

            if (valRaw === "tudo") {
                quantia = (action === "depositar" || action === "depo") ? carteira : banco;
            } else {
                quantia = BigInt(valRaw.replace(/\D/g, "") || 0);
            }

            if (quantia <= 0n) return interaction.editReply("❌ Informe um valor válido.");

            if (action.includes("depo")) {
                if (carteira < quantia) return interaction.editReply("❌ Você não tem esse valor na carteira.");
                await query("UPDATE economia_usuarios SET carteira = carteira - ?, banco = banco + ? WHERE user_id = ?", [quantia.toString(), quantia.toString(), user.id]);
                return interaction.editReply(`✅ Você depositou **${quantia.toLocaleString()}** Wardcoins!`);
            } 
            
            if (action.includes("sac")) {
                if (banco < quantia) return interaction.editReply("❌ Você não tem esse valor no banco.");
                await query("UPDATE economia_usuarios SET banco = banco - ?, carteira = carteira + ? WHERE user_id = ?", [quantia.toString(), quantia.toString(), user.id]);
                return interaction.editReply(`✅ Você sacou **${quantia.toLocaleString()}** Wardcoins!`);
            }

            return interaction.editReply("❌ Ação inválida! Use 'depositar' ou 'sacar'.");
        }

        // 3. BOTÕES DE INVENTÁRIO E INSÍGNIAS
        if (interaction.isButton()) {
            const targetId = customId.split("_")[1];

            if (customId.startsWith("inventory_")) {
                const items = await query(
                    "SELECT l.item_nome, i.quantidade FROM economia_inventario i JOIN economia_loja l ON i.item_id = l.id WHERE i.user_id = ?",
                    [targetId]
                );
                const embed = new EmbedBuilder().setTitle("🎒 Inventário").setColor("#9B59B6");
                embed.setDescription(items.length ? items.map(i => `**${i.item_nome}** x${i.quantidade}`).join("\n") : "O inventário está vazio.");
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (customId.startsWith("badges_")) {
                const results = await query("SELECT level, (carteira + banco) as total FROM economia_usuarios WHERE user_id = ?", [targetId]);
                const d = results[0];
                const badges = [];
                if (d?.level >= 10) badges.push("⭐ **Veterano**: Nível 10+");
                if (BigInt(d?.total || 0) >= 1000000n) badges.push("💎 **Milionário**: Patrimônio de 1M+");
                
                const embed = new EmbedBuilder().setTitle("🏅 Insígnias").setColor("#F1C40F")
                    .setDescription(badges.join("\n") || "Nenhuma insígnia conquistada ainda.");
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
