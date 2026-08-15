const math = require('mathjs');

module.exports = {
  name: 'calcular',
  description: 'Realiza cálculos aritméticos.',
  async execute(message, args) {
    const expression = args.join(' ').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
    if (!expression || expression.length > 100 || !/^[\d\s+\-*/^().%]+$/.test(expression)) {
      return message.reply('❌ Use uma expressão aritmética válida de até 100 caracteres.');
    }
    try {
      const result = math.evaluate(expression);
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        return message.reply('❌ O resultado não é um número finito.');
      }
      return message.reply(`🧮 \`${expression}\` = **${result.toLocaleString('pt-BR')}**`);
    } catch {
      return message.reply('❌ Não foi possível calcular essa expressão.');
    }
  },
};
