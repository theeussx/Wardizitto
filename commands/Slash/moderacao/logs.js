const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("logs")
        .setDescription("🛡️ Configura ou visualiza os logs de moderação do servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName("configurar")
            .setDescription("Define o canal de logs.")
            .addChannelOption(opt => opt.setName("canal").setDescription("O canal onde os logs serão enviados.").setRequired(true)))
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("Verifica o status atual dos logs.")),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "configurar") {
            const channel = interaction.options.getChannel("canal");
            // Aqui você salvaria no banco de dados a configuração do canal de logs
            // Exemplo: await query("UPDATE servidor_config SET log_channel = ? WHERE guild_id = ?", [channel.id, interaction.guild.id]);
            
            return interaction.reply({ content: `✅ Canal de logs configurado para ${channel}!`, ephemeral: true });
        }

        if (subcommand === "status") {
            const embed = new EmbedBuilder()
                .setTitle("🛡️ Status dos Logs de Moderação")
                .setDescription("Os logs estão ativos e monitorando as seguintes ações:\n- Expulsões\n- Banimentos\n- Mensagens Deletadas\n- Alterações de Cargos")
                .setColor("#5865F2")
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
