const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('「Moderação」Limpa mensagens no canal.')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de mensagens a apagar (máx. 100).')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('<:eg_cross:1353597108640415754> Você precisa da permissão `Gerenciar Mensagens` para usar este comando.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const amount = interaction.options.getInteger('quantidade');

        if (amount < 1 || amount > 100) {
            const embed = new EmbedBuilder()
                .setColor('Yellow')
                .setDescription('<:eg_excl:1353597115196244031> Por favor, forneça um número entre **1 e 100**.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`<:icons_correct:1353597185542979664> Foram apagadas **${deleted.size} mensagens** com sucesso.`);

            const reply = await interaction.reply({ embeds: [embed], ephemeral: true });

            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 5000);

        } catch (err) {
            console.error('Erro ao apagar mensagens:', err);

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('<:eg_cross:1353597108640415754> Erro ao apagar mensagens')
                .setDescription('Não foi possível apagar as mensagens. Verifique se elas têm mais de 14 dias ou se o bot tem permissões suficientes.');

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};