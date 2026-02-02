const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("perfil")
        .setDescription("✨ Veja suas informações personalizadas e conquistas.")
        .addUserOption(option => 
            option.setName("usuario")
                .setDescription("Selecione um usuário para visualizar.")),

    async execute(interaction) {
        const target = interaction.options.getUser("usuario") || interaction.user;
        const userId = target.id;
        const isOwnProfile = target.id === interaction.user.id;

        // Flags para Janeiro de 2026
        const replyFlags = [MessageFlags.IsComponentsV2];
        if (!isOwnProfile) replyFlags.push(MessageFlags.Ephemeral);

        await interaction.deferReply({ flags: replyFlags });

        try {
            const results = await query(`
                SELECT u.*, p.profissao 
                FROM economia_usuarios u 
                LEFT JOIN economia_profissoes p ON u.user_id = p.user_id 
                WHERE u.user_id = ?`, [userId]);

            const data = results[0];

            if (!data) {
                return interaction.editReply({ content: "❌ Usuário não registrado no sistema." });
            }

            const xpNecessario = data.level * 500;
            const progresso = Math.min(Math.floor((data.xp / xpNecessario) * 10), 10);
            const barraXP = "▰".repeat(progresso) + "▱".repeat(10 - progresso);
            const saldoTotal = (BigInt(data.carteira) + BigInt(data.banco)).toLocaleString();

            // --- CONSTRUÇÃO DO CONTAINER V2 ---
            const profileContainer = new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(t => t.setContent(`## 👤 Perfil: ${target.username}\n> ${data.sobre_mim || "Sem descrição."}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `### ⭐ Status\n**Nível:** \`${data.level}\` | **Profissão:** \`${data.profissao || "Desempregado"}\`\n**XP:** \`${data.xp} / ${xpNecessario}\`\n${barraXP}`
                ))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `### 🪙 Economia\n**Carteira:** \`${data.carteira.toLocaleString()}\`\n**Banco:** \`${data.banco.toLocaleString()}\`\n**Patrimônio:** ⭐ **${saldoTotal}** Wardcoins`
                ));

            // BOTÕES LATERAIS (Apenas se for o dono)
            if (isOwnProfile) {
                profileContainer.addSeparatorComponents(new SeparatorBuilder());
                profileContainer.addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Banco Wardizitto**\nGerencie seu saldo bancário."))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("atm_manage").setLabel("Acessar").setStyle(ButtonStyle.Success))
                );
            }

            // --- SOLUÇÃO DO ERRO (UNION_TYPE_CHOICES) ---
            // Envolvemos o Container V2 em uma ActionRow de nível 1
            const mainRow = new ActionRowBuilder().addComponents(profileContainer);

            const rowUtils = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inventory_${userId}`).setLabel("Inventário").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`badges_${userId}`).setLabel("Insígnias").setEmoji("🏅").setStyle(ButtonStyle.Success)
            );

            await interaction.editReply({ 
                components: [mainRow, rowUtils] 
            });

        } catch (error) {
            console.error("Erro no Perfil:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro interno ao carregar o perfil." });
        }
    }
};
