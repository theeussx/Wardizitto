const { SlashCommandBuilder } = require('@discordjs/builders');
const { AttachmentBuilder } = require('discord.js');
const figlet = require('figlet');
const emojis = require('../../databases/emojis.json'); // Caminho dos emojis

// Função para obter emojis
function getEmoji(name, animated = false) {
  const category = animated ? emojis.animated : emojis.static;
  return category[name] ? `<${animated ? 'a' : ''}:${name}:${category[name]}>` : '';
}

// Função para dividir o texto em partes menores
function splitText(text, maxLength) {
  const parts = [];
  while (text.length > maxLength) {
    let part = text.slice(0, maxLength);
    const lastNewLine = part.lastIndexOf('\n');
    if (lastNewLine > 0) {
      part = part.slice(0, lastNewLine);
    }
    parts.push(part);
    text = text.slice(part.length);
  }
  parts.push(text);
  return parts;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ascii')
    .setDescription('「Diversão」Converte texto em arte ASCII e oferece o arquivo para download')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Texto para arte ASCII')
        .setRequired(true)),

  cooldown: 10,  // Cooldown de 10 segundos

  async execute(interaction) {
    await interaction.deferReply(); // Para processamento demorado

    const input = interaction.options.getString('input');
    const artEmoji = getEmoji('eg_art'); // Emoji de arte
    const errorEmoji = getEmoji('eg_wrong'); // Emoji de erro

    // Converte o texto para ASCII
    figlet(input, async (err, data) => {
      if (err) {
        console.error('Erro no ASCII:', err);
        return await interaction.editReply({
          content: `${errorEmoji} | Ocorreu um erro na conversão!`,
        });
      }

      // Limita o tamanho para evitar erros do Discord
      const maxLength = 1800; // Deixamos uma margem para o conteúdo adicional
      const fileName = 'ascii_art.txt'; // Nome do arquivo

      // Caso a arte ASCII seja grande, divide em partes menores
      if (data.length > maxLength) {
        const parts = splitText(data, maxLength);

        // Envia a primeira parte como resposta principal
        await interaction.editReply({
          content: `${artEmoji} **Arte ASCII gerada (Parte 1):**\n\`\`\`\n${parts[0]}\n\`\`\``,
        });

        // Envia as partes restantes como mensagens adicionais
        for (let i = 1; i < parts.length; i++) {
          await interaction.followUp({
            content: `${artEmoji} **Parte ${i + 1}:**\n\`\`\`\n${parts[i]}\n\`\`\``,
          });
        }
      } else {
        // Se o texto for pequeno, envia normalmente
        await interaction.editReply({
          content: `${artEmoji} **Arte ASCII gerada:**\n\`\`\`\n${data}\n\`\`\``,
        });
      }

      // Cria o arquivo com o AttachmentBuilder
      const attachment = new AttachmentBuilder(Buffer.from(data), { name: fileName });
      await interaction.followUp({
        content: `${artEmoji} **Clique para baixar o arquivo com a arte ASCII:**`,
        files: [attachment],
      });
    });
  },
};