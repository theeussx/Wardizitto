const math = require('mathjs');

module.exports = {
  name: 'calcular',
  description: 'Realiza cálculos matemáticos.',
  usage: '[expressao]',
  async execute(message, args) {
    let expressao = args.join(' ');

    // Substitui operadores e formatações
    expressao = expressao
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.'); // <- aqui converte vírgulas em pontos

    // ...existing code...
  }
};