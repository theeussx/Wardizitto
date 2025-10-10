const { SlashCommandBuilder } = require('discord.js');
const math = require('mathjs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calcular')
    .setDescription('「Utilidades」Realiza cálculos matemáticos.')
    .addStringOption(option =>
      option.setName('expressao')
        .setDescription('A expressão matemática que deseja calcular.')
        .setRequired(true)
    ),
  async execute(interaction) {
    let expressao = interaction.options.getString('expressao');

    // Substitui operadores e formatações
    expressao = expressao
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.'); // <- aqui converte vírgulas em pontos

    const calcEmoji = '<:eg_tools:1353597168912437341>';

    try {
      const resultado = math.evaluate(expressao);
      await interaction.reply(`${calcEmoji} O resultado de \`${expressao}\` é **${resultado}**.`);
    } catch (error) {
      await interaction.reply(`${calcEmoji} ⚠️ A expressão fornecida é inválida. Tente novamente com uma expressão válida.`);
    }
  },
};