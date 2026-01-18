const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType } = require('discord.js');
const { query } = require('../../../handlers/db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Abre o painel de configuração avançada do sistema de tickets.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        await this.sendConfigPanel(interaction);
    },

    async sendConfigPanel(interaction) {
        const config = (await query('SELECT * FROM tickets_config WHERE guild_id = ?', [interaction.guild.id]))[0] || {};

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuração de Tickets - Wardizitto')
            .setDescription('Personalize o sistema de tickets usando os menus e botões abaixo.')
            .addFields(
                { name: '📁 Categoria', value: config.category_id ? `<#${config.category_id}>` : '❌ Não configurado', inline: true },
                { name: '🛠️ Cargo Suporte', value: config.support_role_id ? `<@&${config.support_role_id}>` : '❌ Não configurado', inline: true },
                { name: '📜 Canal Logs', value: config.logs_channel_id ? `<#${config.logs_channel_id}>` : '❌ Não configurado', inline: true },
                { name: '📺 Canal Painel', value: config.panel_channel_id ? `<#${config.panel_channel_id}>` : '❌ Não configurado', inline: true }
            )
            .setColor('#5865F2')
            .setTimestamp();

        // Row 1: Seleção de Canais e Categorias
        const row1 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_ticket_category')
                .setPlaceholder('Escolha a Categoria dos Tickets')
                .setChannelTypes(ChannelType.GuildCategory)
        );

        // Row 2: Seleção de Canais de Logs e Painel
        const row2 = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_ticket_channels')
                .setPlaceholder('Escolha os Canais (Logs e Painel)')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(2)
                .setMaxValues(2)
        );

        // Row 3: Seleção de Cargo de Suporte
        const row3 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('select_ticket_role')
                .setPlaceholder('Escolha o Cargo de Suporte')
        );

        // Row 4: Botões de Ação
        const isReady = config.category_id && config.support_role_id && config.panel_channel_id;
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('config_ticket_appearance').setLabel('Personalizar Embed').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('send_ticket_panel').setLabel('Enviar Painel').setEmoji('📤').setStyle(ButtonStyle.Success).setDisabled(!isReady)
        );

        const response = { embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(response);
        } else {
            await interaction.reply(response);
        }
    }
};
