const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config.json');
const GROQ_API_KEY = config.groqApiKey;
const iso6391 = require('iso-639-1');

// Função para exibir o código customizado: se o código for "pt", exibe "BR"; caso contrário, em maiúsculas.
function displayCode(code) {
return code === "pt" ? "BR" : code.toUpperCase();
}

module.exports = {
data: new SlashCommandBuilder()
.setName('traduzir')
.setDescription('「Utilidades」Traduz um texto para um ou mais idiomas.')
.addStringOption(option =>
option.setName('texto')
.setDescription('O texto que deseja traduzir.')
.setRequired(true))
.addStringOption(option =>
option.setName('idioma')
.setDescription('Códigos ISO dos idiomas (ex: en, es, fr ou "todos"). Separe por vírgula.')
.setRequired(true)),

async execute(interaction) {
const texto = interaction.options.getString('texto');
let idiomaInput = interaction.options.getString('idioma').trim().toLowerCase();

let idiomas = [];  
// Se o usuário digitar "todos", usa todos os códigos disponíveis  
if (idiomaInput === "todos") {  
  idiomas = iso6391.getAllCodes();  
} else {  
  // Divide os códigos por vírgula, remove espaços e filtra entradas vazias,  
  // mapeando "br" para "pt"  
  idiomas = idiomaInput.split(',')  
    .map(code => code.trim())  
    .filter(code => code !== '')  
    .map(code => code === "br" ? "pt" : code);  
}  

// Verifica se todos os códigos são válidos (ISO 639-1)  
const invalidCodes = idiomas.filter(code => !iso6391.validate(code));  
if (invalidCodes.length > 0) {  
  return interaction.reply(`❌ Os seguintes códigos não são válidos: ${invalidCodes.join(', ')}. Utilize códigos ISO (ex: en, es, fr, br).`);  
}  

try {  
  // Para cada idioma, cria uma requisição à API Grooq para traduzir o texto  
  const translationPromises = idiomas.map(async lang => {  
    const userPrompt = `Traduza o seguinte texto para o idioma correspondente ao código "${lang}": ${texto}`;  
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'Authorization': `Bearer ${GROQ_API_KEY}`,  
      },  
      body: JSON.stringify({  
        model: "llama3-8b-8192",  
        messages: [  
          { role: "system", content: "Você é um tradutor profissional. Apenas responda com o texto traduzido. Não forneça explicações." },  
          { role: "user", content: userPrompt }  
        ],  
        temperature: 0.5,  
        max_tokens: 1024,  
        top_p: 1,  
        stream: false,  
      }),  
    });  
  
    if (!response.ok) {  
      console.error(`Grooq API error para ${lang}:`, response.statusText);  
      return { lang, translation: "Erro na tradução." };  
    }  
  
    const data = await response.json();  
    const translation = data.choices && data.choices.length > 0  
      ? data.choices[0].message.content.trim()  
      : "Sem tradução disponível.";  
    return { lang, translation };  
  });  
  
  const translations = await Promise.all(translationPromises);  
  
  // Cria o embed com os resultados utilizando o emoji de tradução  
  const embed = new EmbedBuilder()  
    .setTitle(`<:icons_translate:1353597710590152815> Traduções`)  
    .setColor(0x1ABC9C)  
    .setDescription("Confira abaixo as traduções para os idiomas solicitados:");  
  
  translations.forEach(result => {  
    const langName = iso6391.getName(result.lang) || result.lang;  
    embed.addFields({ name: `${langName} (${displayCode(result.lang)})`, value: result.translation || "Sem tradução disponível." });  
  });  
  
  // Botão para copiar todas as traduções (usando o emoji que representa uma planilha/lista)  
  const copyButton = new ButtonBuilder()  
    .setCustomId('copy_all')  
    .setLabel('Copiar Todas')  
    .setEmoji('<:icons_list:1353597446369841184>')  
    .setStyle(ButtonStyle.Primary);  
  
  const row = new ActionRowBuilder().addComponents(copyButton);  
  
  await interaction.reply({ embeds: [embed], components: [row] });  
  
  // Coletor para o botão: ao clicar, o usuário recebe uma mensagem efêmera com todas as traduções (em texto puro)  
  const collector = interaction.channel.createMessageComponentCollector({  
    filter: i => i.customId === 'copy_all' && i.user.id === interaction.user.id,  
    time: 60000,  
    max: 1,  
  });  
  
  collector.on('collect', async i => {  
    const allTranslations = translations.map(result => {  
      const langName = iso6391.getName(result.lang) || result.lang;  
      return `${langName} (${displayCode(result.lang)}):\n${result.translation}`;  
    }).join("\n\n");  
    await i.reply({ content: allTranslations, ephemeral: true });  
  });  
} catch (error) {  
  console.error(error);  
  await interaction.reply('❌ Ocorreu um erro ao processar as traduções.');  
}

}
};

