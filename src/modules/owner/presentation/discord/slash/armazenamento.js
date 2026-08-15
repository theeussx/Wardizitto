const { isOwner } = require('../../../../../core/security/owner.js');
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver')
    .setDescription('Mostra métricas de armazenamento do banco de dados.'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Acesso negado.', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const databaseName = interaction.client.services.config.DB_NAME;
    const tables = await query(
      `SELECT table_name AS tableName,
              data_length AS dataBytes,
              index_length AS indexBytes,
              table_rows AS estimatedRows
         FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY (data_length + index_length) DESC`,
      [databaseName],
    );
    const totalBytes = tables.reduce(
      (total, table) => total + Number(table.dataBytes || 0) + Number(table.indexBytes || 0),
      0,
    );
    const lines = tables
      .slice(0, 20)
      .map(
        (table) =>
          `\`${table.tableName}\` — ${(
            (Number(table.dataBytes || 0) + Number(table.indexBytes || 0)) /
            1024 /
            1024
          ).toFixed(2)} MB · ~${Number(table.estimatedRows || 0).toLocaleString('pt-BR')} linhas`,
      );

    const label = new LabelBuilder()
      .setColor(Colors.Teal)
      .setTitle('Armazenamento do banco')
      .setDescription(
        `**Banco:** \`${databaseName}\`\n**Total:** ${(totalBytes / 1024 / 1024).toFixed(2)} MB\n\n${lines.join('\n') || 'Nenhuma tabela.'}`,
      )
      .setFooter(`Exibindo ${Math.min(tables.length, 20)} de ${tables.length} tabelas`)
      .setTimestamp();

    return interaction.editReply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
