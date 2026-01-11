const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../handlers/db.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("saldo")
        .setDescription("Veja o seu saldo de Wardcoins.")
        .addUserOption(option => option.setName("usuario").setDescription("O usuário para ver o saldo.")),

    async execute(interaction) {
        const target = interaction.options.getUser("usuario") || interaction.user;
        await interaction.deferReply();

        try {
            let data = (await query("SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?", [target.id]))[0];
            
            if (!data) {
                await query("INSERT INTO economia_usuarios (user_id) VALUES (?)", [target.id]);
                data = { carteira: 0, banco: 0 };
            }

            const total = data.carteira + data.banco;

            const embed = new EmbedBuilder()
                .setTitle(`Saldo de ${target.username}`)
                .setColor("#2ECC71")
                .addFields(
                    { name: "🪙 Carteira", value: `\`${data.carteira.toLocaleString()}\` Wardcoins`, inline: true },
                    { name: "🏦 Banco", value: `\`${data.banco.toLocaleString()}\` Wardcoins`, inline: true },
                    { name: "💰 Total", value: `\`${total.toLocaleString()}\` Wardcoins`, inline: false }
                )
                .setThumbnail("https://cdn.discordapp.com/emojis/1353597230195408917.png")
                .setFooter({ text: "Wardizitto Economy", iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("deposit_all").setLabel("Depositar Tudo").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("withdraw_all").setLabel("Sacar Tudo").setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Erro ao buscar saldo.");
        }
    }
};
