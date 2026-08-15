const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const iso6391 = require('iso-639-1');
const { truncateUserContent } = require('../../../../../core/security/content.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('traduzir')
    .setDescription('Traduz um texto para até cinco idiomas.')
    .addStringOption((option) =>
      option
        .setName('texto')
        .setDescription('Texto a traduzir.')
        .setMaxLength(1000)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('idioma')
        .setDescription('Códigos ISO separados por vírgula: en, es, fr.')
        .setRequired(true),
    ),

  async execute(interaction) {
    const text = truncateUserContent(interaction.options.getString('texto', true), 1000);
    const languages = [
      ...new Set(
        interaction.options
          .getString('idioma', true)
          .toLowerCase()
          .split(',')
          .map((code) => (code.trim() === 'br' ? 'pt' : code.trim()))
          .filter(Boolean),
      ),
    ];
    if (
      languages.length === 0 ||
      languages.length > 5 ||
      languages.some((code) => !iso6391.validate(code))
    ) {
      return interaction.reply({
        content: '❌ Informe de um a cinco códigos ISO 639-1 válidos.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const {
      GROQ_API_KEY: apiKey,
      GROQ_MODEL: model,
      HTTP_TIMEOUT_MS: timeout,
    } = interaction.client.services.config;
    if (!apiKey) {
      return interaction.reply({
        content: '❌ O serviço de tradução não está configurado.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply();

    const translations = [];
    for (const language of languages) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `Translate the user text to ISO language ${language}. Return only the translation.`,
            },
            { role: 'user', content: text },
          ],
          temperature: 0.2,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error(`Groq respondeu HTTP ${response.status}.`);
      const payload = await response.json();
      const translated = payload.choices?.[0]?.message?.content?.trim();
      translations.push({
        language,
        value: typeof translated === 'string' ? translated.slice(0, 1024) : 'Sem tradução.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 Traduções')
      .setColor('#1abc9c')
      .addFields(
        translations.map(({ language, value }) => ({
          name: `${iso6391.getName(language) || language} (${language.toUpperCase()})`,
          value,
        })),
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
