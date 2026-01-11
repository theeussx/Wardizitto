const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorte-azar')
        .setDescription('「Diversão」Sorteia um número entre 1 e 100!'),
    async execute(interaction) {
        const numeroSorteado = Math.floor(Math.random() * 100) + 1;
        await interaction.reply(`O número sorteado foi: ${numeroSorteado}`);
    },
};