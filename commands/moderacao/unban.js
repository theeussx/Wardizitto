const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('「Moderação」Desbane um usuário pelo ID.')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('O ID do usuário a ser desbanido.')
                .setRequired(true)),

    async execute(interaction) {
        // Verifica se o membro tem permissão de "Banir Membros"
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: '❌ Você não tem permissão para usar este comando, apenas usuários com a função **BANIR MEMBROS**.',
                ephemeral: true,
            });
        }

        const userIdToUnban = interaction.options.getString('userid');

        // Verifica se o ID fornecido é válido
        if (!userIdToUnban || isNaN(userIdToUnban)) {
            return interaction.reply({
                content: '❌ Por favor, forneça um ID de usuário válido.',
                ephemeral: true,
            });
        }

        try {
            // Buscar o usuário banido pelo ID
            const bannedUser = await interaction.guild.bans.fetch(userIdToUnban).catch(() => null);

            // Se o usuário não estiver banido
            if (!bannedUser) {
                return interaction.reply({
                    content: '❌ Este usuário não está banido ou o ID é inválido.',
                    ephemeral: true,
                });
            }

            // Remover o banimento do usuário
            await interaction.guild.bans.remove(userIdToUnban);
            await interaction.reply({
                content: `✅ O usuário \`${bannedUser.user.tag}\` foi desbanido com sucesso.`,
                ephemeral: false,
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao tentar desbanir o usuário. Verifique se o ID está correto ou se o bot tem permissões adequadas.',
                ephemeral: true,
            });
        }
    },
};