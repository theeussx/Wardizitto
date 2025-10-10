const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adivinhar')
        .setDescription('「Diversão」Tente adivinhar o número que estou pensando de 1 a 10!'),
    async execute(interaction) {
        const numeroPensado = Math.floor(Math.random() * 10) + 1;
        const resposta = await interaction.reply({ content: 'Pensei em um número de 1 a 10. Tente adivinhar!', fetchReply: true });

        // Espera 10 segundos antes de revelar a resposta
        setTimeout(() => {
            interaction.editReply(`O número era: ${numeroPensado}`);
        }, 10000);
    },
};