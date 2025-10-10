const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../../handlers/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casamento')
    .setDescription('「Social」Veja com quem você está casado.'),

  async execute(interaction) {
    const usuario = interaction.user.id;
    const [result] = await pool.query('SELECT * FROM casamentos WHERE user_id = ? OR parceiro_id = ?', [usuario, usuario]);

    if (result.length === 0)
      return interaction.reply({ content: 'Você não está casado.', ephemeral: true });

    const casamento = result[0];
    const parceiroId = casamento.user_id === usuario ? casamento.parceiro_id : casamento.user_id;
    const parceiro = await interaction.client.users.fetch(parceiroId);

    const embed = new EmbedBuilder()
      .setTitle('Casamento')
      .setDescription(`Você está casado com ${parceiro.tag}`)
      .setColor('Purple')
      .setFooter({ text: `Desde: ${new Date(casamento.data).toLocaleDateString('pt-BR')}` });

    interaction.reply({ embeds: [embed] });
  }
};