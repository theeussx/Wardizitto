const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('「Moderação」Faz o bot enviar uma mensagem personalizada em um canal.')
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('A mensagem que o bot deve enviar.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde a mensagem será enviada (opcional).')
                .addChannelTypes(ChannelType.GuildText)) // Garante que só canais de texto do servidor apareçam
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Só quem tem permissão pode usar

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '⚠️ Você não tem permissão para usar este comando.',
                ephemeral: true,
            });
        }

        const mensagem = interaction.options.getString('mensagem');
        const canalSelecionado = interaction.options.getChannel('canal');
        const canalDestino = canalSelecionado || interaction.channel;

        try {
            await canalDestino.send(mensagem);
            await interaction.reply({ content: `✅ Mensagem enviada com sucesso em ${canalDestino}.`, ephemeral: true });
        } catch (error) {
            console.error('Erro ao enviar a mensagem:', error);
            await interaction.reply({ content: '⚠️ Ocorreu um erro ao tentar enviar a mensagem.', ephemeral: true });
        }
    },
};