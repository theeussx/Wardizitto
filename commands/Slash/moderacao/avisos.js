const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const db = require('../../../handlers/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avisos')
        .setDescription('Gerenciar avisos de um usuário.')
        .addUserOption(opt =>
            opt.setName('usuário')
                .setDescription('Usuário para gerenciar avisos')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('usuário');
        const guildId = interaction.guild.id;
        const moderatorId = interaction.user.id;

        let warns = [];
        try {
            const [rows] = await db.query(
                'SELECT * FROM warns WHERE guild_id = ? AND user_id = ?',
                [guildId, targetUser.id]
            );
            warns = Array.isArray(rows) ? rows : rows?.rows || [];
        } catch (error) {
            console.error('Erro ao consultar avisos:', error);
            return interaction.reply({
                content: '❌ Erro ao consultar avisos. Tente novamente mais tarde.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Avisos de ${targetUser.username}`)
            .setColor(warns.length ? '#FF4500' : '#32CD32')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🔔 Total de Avisos', value: warns.length.toString(), inline: true },
                { name: '📅 Última Atualização', value: new Date().toLocaleString('pt-BR'), inline: true }
            )
            .setDescription(
                warns.length
                    ? warns.map((w, i) =>
                        `🔔 **Aviso #${i + 1}:** ${w.reason || 'Sem motivo especificado'} *(por <@${w.moderator_id}>, ${new Date(w.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })})*`
                      ).join('\n')
                    : '✅ Este usuário não possui avisos registrados. 🎉'
            )
            .setFooter({ text: `ID: ${targetUser.id} | Solicitado por: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`warn_add_${targetUser.id}_${moderatorId}`)
                .setLabel('Dar Aviso')
                .setEmoji('⚠️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`warn_remove_${targetUser.id}_${moderatorId}`)
                .setLabel('Remover Aviso')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!warns.length),
            new ButtonBuilder()
                .setCustomId(`warn_clear_${targetUser.id}_${moderatorId}`)
                .setLabel('Limpar Avisos')
                .setEmoji('🧹')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!warns.length)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};