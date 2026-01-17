const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { pool } = require('../../handlers/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contagem')
    .setDescription('Sistema de contagem')
    .addSubcommand(sub =>
      sub.setName('configurar')
        .setDescription('Define o canal da contagem')
        .addChannelOption(opt =>
          opt.setName('canal')
            .setDescription('Canal de contagem')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('limpar')
        .setDescription('Reseta a contagem para 0')
    )
    .addSubcommand(sub =>
      sub.setName('parar')
        .setDescription('Desativa a contagem')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const conn = await pool.getConnection();

    try {
      if (sub === 'configurar') {
        const canal = interaction.options.getChannel('canal');

        await conn.execute(`
          INSERT INTO contagens (guild_id, canal_id, ultima_contagem, ativo)
          VALUES (?, ?, 0, TRUE)
          ON DUPLICATE KEY UPDATE canal_id = ?, ultima_contagem = 0, ativo = TRUE
        `, [guildId, canal.id, canal.id]);

        await interaction.reply(`✅ Contagem configurada no canal ${canal}.`);

      } else if (sub === 'limpar') {
        const [rows] = await conn.execute('SELECT * FROM contagens WHERE guild_id = ?', [guildId]);
        if (!rows[0] || !rows[0].ativo) return interaction.reply('⚠️ Nenhuma contagem ativa.');

        await conn.execute('UPDATE contagens SET ultima_contagem = 0 WHERE guild_id = ?', [guildId]);
        await interaction.reply('🔁 Contagem reiniciada.');

      } else if (sub === 'parar') {
        const [rows] = await conn.execute('SELECT * FROM contagens WHERE guild_id = ?', [guildId]);
        if (!rows[0] || !rows[0].ativo) return interaction.reply('⚠️ Nenhuma contagem ativa.');

        await conn.execute('UPDATE contagens SET ativo = FALSE WHERE guild_id = ?', [guildId]);
        await interaction.reply('🛑 Contagem desativada.');
      }
    } catch (err) {
      console.error(err);
      await interaction.reply('❌ Erro ao executar o comando.');
    } finally {
      conn.release();
    }
  }
};