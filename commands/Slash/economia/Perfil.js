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

        // Flags para suporte a Componentes V2 (Discord v14.17+)
        const replyFlags = [MessageFlags.IsComponentsV2];
        if (!isOwnProfile) replyFlags.push(MessageFlags.Ephemeral);

        await interaction.deferReply({ flags: replyFlags });

        try {
            // Busca dados do usuário e profissão
            const results = await query(`
                SELECT u.*, p.nome_profissao as profissao 
                FROM economia_usuarios u 
                LEFT JOIN economia_profissoes p ON u.profissao_id = p.id 
                WHERE u.user_id = ?`, [userId]);

            const data = results[0];

            if (!data) {
                return interaction.editReply({ content: "❌ Este usuário ainda não possui uma conta no sistema de economia." });
            }

            // Cálculos de XP e Barra de Progresso
            const level = data.level || 1;
            const xp = data.xp || 0;
            const xpNecessario = level * 500;
            const progresso = Math.min(Math.floor((xp / xpNecessario) * 10), 10);
            const barraXP = "▰".repeat(progresso) + "▱".repeat(10 - progresso);
            
            // Tratamento de valores monetários com BigInt para evitar overflow
            const carteira = BigInt(data.carteira || 0);
            const banco = BigInt(data.banco || 0);
            const saldoTotal = (carteira + banco).toLocaleString();

            // --- CONSTRUÇÃO DO CONTAINER V2 ---
            const profileContainer = new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(t => t.setContent(`## 👤 Perfil: ${target.username}\n> ${data.sobre_mim || "Este usuário ainda não definiu um 'sobre mim'."}`))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `### ⭐ Status\n**Nível:** \`${level}\` | **Profissão:** \`${data.profissao || "Desempregado"}\`\n**XP:** \`${xp} / ${xpNecessario}\`\n${barraXP}`
                ))
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(t => t.setContent(
                    `### 🪙 Economia\n**Carteira:** \`${carteira.toLocaleString()}\` 🪙\n**Banco:** \`${banco.toLocaleString()}\` 🏦\n**Patrimônio:** ⭐ **${saldoTotal}** Wardcoins`
                ));

            // Seção de Gerenciamento (Apenas para o próprio usuário)
            if (isOwnProfile) {
                profileContainer.addSeparatorComponents(new SeparatorBuilder());
                profileContainer.addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("**Banco Wardizitto**\nGerencie seu saldo bancário com segurança."))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("atm_manage").setLabel("Acessar ATM").setStyle(ButtonStyle.Success))
                );
            }

            // --- ORGANIZAÇÃO DOS COMPONENTES ---
            // O ContainerBuilder deve ser enviado dentro de uma ActionRow
            const mainRow = new ActionRowBuilder().addComponents(profileContainer);

            const rowUtils = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inventory_${userId}`).setLabel("Inventário").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`badges_${userId}`).setLabel("Insígnias").setEmoji("🏅").setStyle(ButtonStyle.Success)
            );

            await interaction.editReply({ 
                components: [mainRow, rowUtils] 
            });

        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro interno ao carregar as informações do perfil." });
        }
    }
};
