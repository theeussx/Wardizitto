const { SlashCommandBuilder } = require('discord.js');
const emojis = require('../../../databases/emojis.json'); // Caminho dos emojis

// Função para obter emojis com fallback
function getEmoji(name, animated = false) {
  const category = animated ? emojis.animated : emojis.static;
  return category[name] ? `<${animated ? 'a' : ''}:${name}:${category[name]}>` : '🎲'; // Fallback para emoji de dado
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dado')
        .setDescription('「Diversão」Rola um dado personalizado')
        .addIntegerOption(option => 
            option.setName('lados')
                .setDescription('Número de lados do dado (2-1000)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(1000)),
    
    cooldown: 5, // Cooldown de 5 segundos

    async execute(interaction) {
        const lados = interaction.options.getInteger('lados');
        const diceEmoji = getEmoji('eg_dice'); // Emoji personalizado ou fallback
        
        // Verificação extra de segurança
        if (lados < 2 || lados > 1000) {
            return interaction.reply({
                content: `${getEmoji('eg_cautions')} Número inválido! Use entre 2 e 1000 lados.`,
                ephemeral: true
            });
        }

        const resultado = Math.floor(Math.random() * lados) + 1;
        let mensagem = `${diceEmoji} **Dado de ${lados} lados rolado!**\n`;

        // Sistema de crítico/falha
        if (resultado === lados) {
            mensagem += `${getEmoji('eg_star')} **CRÍTICO!** Você tirou **${resultado}**!`;
        } else if (resultado === 1) {
            mensagem += `${getEmoji('eg_wrong')} **FALHA!** Resultado: **${resultado}**`;
        } else {
            mensagem += `${getEmoji('icons_Correct')} Resultado: **${resultado}**`;
        }

        await interaction.reply(mensagem);
    },
};