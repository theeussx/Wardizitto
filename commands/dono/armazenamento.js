const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const { mariaDB } = require('../../config.json');

const ownerId = '1033922089436053535';

// Conversor de tamanhos com unidades
function parseSize(sizeStr) {
  const match = sizeStr.match(/^([\d.]+)([KMGTP]?)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const units = { K: 1 / 1024, M: 1, G: 1024, T: 1024 ** 2, P: 1024 ** 3 };
  return units[unit] ? num * units[unit] : num;
}

// Extrator do limite InnoDB
function parseInnoDBDataFilePath(value) {
  const maxIndex = value.indexOf("max:");
  if (maxIndex === -1) return null;
  const substring = value.substring(maxIndex + 4).split(/[\s,;]+/)[0];
  return parseSize(substring);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver')
    .setDescription('Mostra o uso de armazenamento do banco de dados MariaDB.'),

  async execute(interaction) {
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let connection;
    try {
      connection = await mysql.createConnection({
        host: mariaDB.host,
        user: mariaDB.user,
        password: mariaDB.password,
        database: mariaDB.database,
      });
    } catch (err) {
      console.error('Erro ao conectar no banco:', err);
      return interaction.editReply({ content: 'Erro ao conectar no banco de dados.' });
    }

    let tableStats, innodbValue;
    try {
      const [tables] = await connection.execute(`
        SELECT table_name AS Tabela,
               ROUND((data_length + index_length) / 1024 / 1024, 2) AS Tamanho_MB
        FROM information_schema.TABLES
        WHERE table_schema = ?
        ORDER BY (data_length + index_length) DESC;
      `, [mariaDB.database]);
      tableStats = tables;

      const [innodb] = await connection.execute("SHOW VARIABLES LIKE 'innodb_data_file_path'");
      if (innodb.length > 0) innodbValue = innodb[0].Value;
    } catch (err) {
      console.error('Erro ao executar a consulta:', err);
      return interaction.editReply({ content: 'Erro ao buscar dados do banco.' });
    } finally {
      if (connection) await connection.end();
    }

    if (!tableStats || tableStats.length === 0) {
      return interaction.editReply({ content: 'Nenhuma tabela encontrada no banco de dados.' });
    }

    const totalUsed = tableStats.reduce((acc, row) => acc + parseFloat(row.Tamanho_MB), 0);
    const totalUsedStr = totalUsed.toFixed(2);

    let limitStr = 'Ilimitado';
    let freeStr = 'Ilimitado';
    const maxLimit = innodbValue ? parseInnoDBDataFilePath(innodbValue) : null;

    if (maxLimit !== null) {
      limitStr = `${maxLimit.toFixed(2)} MB`;
      freeStr = `${Math.max(0, maxLimit - totalUsed).toFixed(2)} MB`;
    }

    const embed = new EmbedBuilder()
      .setTitle('**Banco de Dados - Armazenamento**')
      .setColor('#1abc9c')
      .setThumbnail('https://mightward.abccloud.com.br/images/logo.png')
      .setDescription([
        `**Banco:** \`${mariaDB.database}\``,
        `**Uso Total:** \`${totalUsedStr} MB\``,
        `**Limite:** \`${limitStr}\``,
        `**Espaço Livre:** \`${freeStr}\``,
        `\u200B`,
        `__**Tabelas:**__`,
        tableStats.map(row => `> \`${row.Tabela}\` — **${row.Tamanho_MB} MB**`).join('\n')
      ].join('\n'))
      .setFooter({ text: 'MightWard Database Viewer' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ver_tabela')
      .setPlaceholder('Selecione uma tabela para ver o conteúdo')
      .addOptions(
        tableStats.map(row => ({
          label: row.Tabela.length > 25 ? row.Tabela.slice(0, 25) : row.Tabela,
          value: row.Tabela,
        })).slice(0, 25) // Discord permite até 25 opções
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = interaction.channel.createMessageComponentCollector({
      componentType: 3,
      time: 60000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async i => {
      const selectedTable = i.values[0];
      let contentRows;

      try {
        const conn = await mysql.createConnection({
          host: mariaDB.host,
          user: mariaDB.user,
          password: mariaDB.password,
          database: mariaDB.database,
        });

        const [rows] = await conn.execute(`SELECT * FROM \`${selectedTable}\` LIMIT 10`);
        await conn.end();

        contentRows = rows;
      } catch (err) {
        console.error('Erro ao buscar conteúdo da tabela:', err);
        return i.reply({ content: 'Erro ao buscar conteúdo da tabela.', ephemeral: true });
      }

      if (!contentRows || contentRows.length === 0) {
        return i.reply({ content: `A tabela \`${selectedTable}\` está vazia.`, ephemeral: true });
      }

      const preview = contentRows.map((row, idx) => {
        const values = Object.entries(row).map(([k, v]) => `\`${k}\`: ${String(v).slice(0, 40)}`);
        return `**#${idx + 1}**\n${values.join('\n')}`;
      }).join('\n\n');

      await i.reply({
        ephemeral: true,
        content: `🗂️ Conteúdo da tabela \`${selectedTable}\` (máx 10 registros):\n\n${preview}`
      });
    });
  },
};