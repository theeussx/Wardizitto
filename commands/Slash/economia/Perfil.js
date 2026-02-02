const { 
    SlashCommandBuilder, ContainerBuilder, ButtonBuilder, ButtonStyle, 
    ActionRowBuilder, MessageFlags, SeparatorBuilder 
} = require("discord.js");
const { query } = require("../../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("perfil")
        .setDescription("✨ Veja suas informações personalizadas e conquistas.")
        .addUserOption(option => option.setName("usuario").setDescription("Selecione um usuário.")),

    async execute(interaction) {
        const target = interaction.options.getUser("usuario") || interaction.user;
        const isOwnProfile = target.id === interaction.user.id;
        
        // Ativa suporte para Container e Separator
        const replyFlags = [MessageFlags.IsComponentsV2];
        if (!isOwnProfile) replyFlags.push(MessageFlags.Ephemeral);

        await interaction.deferReply({ flags: replyFlags });

        try {
            const results = await query(`
                SELECT u.*, p.profissao FROM economia_usuarios u 
                LEFT JOIN economia_profissoes p ON u.user_id = p.user_id 
                WHERE u.user_id = ?`, [target.id]);

            const data = results[0];
            if (!data) return interaction.editReply({ content: "❌ Este usuário não possui uma conta no sistema." });

            const level = data.level || 1;
            const xp = data.xp || 0;
            const xpReq = level * 500;
            const prog = Math.min(Math.floor((xp / xpReq) * 10), 10);
            const barra = "▰".repeat(prog) + "▱".repeat(10 - prog);

            const profileContainer = new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(t => t.setContent(`## 👤 Perfil: ${target.username}\n> ${data.sobre_mim || "Sem descrição."}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(`### ⭐ Status\n**Nível:** \`${level}\` | **XP:** \`${xp}/${xpReq}\`\n${barra}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(`### 🪙 Economia\n**Carteira:** \`${BigInt(data.carteira).toLocaleString()}\` 🪙\n**Banco:** \`${BigInt(data.banco).toLocaleString()}\` 🏦`));

            if (isOwnProfile) {
                profileContainer.addSeparatorComponents(new SeparatorBuilder());
                profileContainer.addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Banco Wardizitto**\nGerencie seu saldo bancário."))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("atm_manage").setLabel("Acessar ATM").setStyle(ButtonStyle.Success))
                );
            }

            const rowUtils = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inventory_${target.id}`).setLabel("Inventário").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`badges_${target.id}`).setLabel("Insígnias").setEmoji("🏅").setStyle(ButtonStyle.Success)
            );

            await interaction.editReply({ 
                components: [profileContainer, rowUtils],
                flags: replyFlags 
            });
        } catch (e) {
            console.error("Erro no Perfil:", e);
            await interaction.editReply({ content: "❌ Erro ao carregar perfil." });
        }
    }
};
