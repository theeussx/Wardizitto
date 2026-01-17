const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

// Função para garantir que o usuário exista no banco de dados
async function ensureUser(userId) {
    let user = (await query("SELECT * FROM economia_usuarios WHERE user_id = ?", [userId]))[0];
    if (!user) {
        await query("INSERT INTO economia_usuarios (user_id) VALUES (?)", [userId]);
        user = (await query("SELECT * FROM economia_usuarios WHERE user_id = ?", [userId]))[0];
    }
    return user;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("perfil")
        .setDescription("Veja o seu perfil econômico ou de outro usuário.")
        .addUserOption(option => 
            option.setName("usuario")
                .setDescription("O usuário para ver o perfil.")
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser("usuario") || interaction.user;
        await interaction.deferReply();

        try {
            const userData = await ensureUser(targetUser.id);
            const professionData = (await query("SELECT profissao FROM economia_profissoes WHERE user_id = ?", [targetUser.id]))[0];
            const profession = professionData ? professionData.profissao : "Desempregado";

            const embed = new EmbedBuilder()
                .setTitle(`Perfil de ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .setColor("#5865F2")
                .addFields(
                    { name: "<:icons_coin:1353597230195408917> Wardcoins", value: `**Carteira:** ${userData.carteira.toLocaleString()}\n**Banco:** ${userData.banco.toLocaleString()}`, inline: true },
                    { name: "<:icons_star:1353597390673936448> Progresso", value: `**Level:** ${userData.level}\n**XP:** ${userData.xp}`, inline: true },
                    { name: "<:icons_tools:1353597168912437341> Profissão", value: `*${profession}*`, inline: true },
                    { name: "📝 Sobre Mim", value: `*${userData.sobre_mim}*` }
                )
                .setFooter({ text: "Wardizitto Economy", iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`inventory_${targetUser.id}`).setLabel("Inventário").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`badges_${targetUser.id}`).setLabel("Insígnias").setEmoji("🏅").setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error("Erro ao buscar perfil:", error);
            const errorEmbed = new EmbedBuilder()
                .setTitle("<:icons_wrong:1353597190920212573> Erro")
                .setDescription("Ocorreu um erro ao carregar o perfil econômico.")
                .setColor("#FF0000");
            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
