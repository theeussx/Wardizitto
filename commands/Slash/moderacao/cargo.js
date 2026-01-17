const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cargo')
        .setDescription('「Moderação」Adiciona um cargo a um membro.')
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('O membro que receberá o cargo.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('cargo')
                .setDescription('O cargo a ser atribuído.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('usuário');
        const role = interaction.options.getRole('cargo');
        const targetMember = interaction.guild.members.cache.get(user.id);

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> Você precisa da permissão `Gerenciar Cargos` para usar este comando.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!targetMember) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('<:eg_cross:1353597108640415754> Membro não encontrado.')
                ],
                ephemeral: true
            });
        }

        if (targetMember.roles.cache.has(role.id)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Yellow')
                        .setDescription(`<:eg_excl:1353597115196244031> O usuário já possui o cargo \`${role.name}\`.`)
                ],
                ephemeral: true
            });
        }

        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('<:eg_cross:1353597108640415754> Não consigo atribuir esse cargo, pois está acima do meu na hierarquia.')
                ],
                ephemeral: true
            });
        }

        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('<:eg_cross:1353597108640415754> Não posso modificar os cargos deste membro devido à hierarquia.')
                ],
                ephemeral: true
            });
        }

        try {
            await targetMember.roles.add(role);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`<:icons_correct:1353597185542979664> O cargo \`${role.name}\` foi atribuído a **${user.tag}** com sucesso!`);

            await interaction.reply({ embeds: [successEmbed] });

        } catch (err) {
            console.error('Erro ao adicionar o cargo:', err);

            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('<:eg_cross:1353597108640415754> Erro ao adicionar cargo')
                .setDescription(err.message.includes('Missing Permissions')
                    ? 'Permissões insuficientes. Verifique se o cargo do bot está configurado corretamente.'
                    : 'Ocorreu um erro inesperado. Tente novamente mais tarde.');

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};