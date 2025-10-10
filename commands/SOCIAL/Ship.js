const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { createCanvas, loadImage, registerFont } = require("@napi-rs/canvas");

// Caso queira usar uma fonte externa (opcional)
// registerFont('./fonts/YourFont.ttf', { family: 'CustomFont' });

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("「social」Descubra o quanto duas pessoas combinam!")
    .addUserOption(option =>
      option.setName("usuario1").setDescription("Primeiro usuário 💖").setRequired(true)
    )
    .addUserOption(option =>
      option.setName("usuario2").setDescription("Segundo usuário 💖").setRequired(true)
    ),

  async execute(interaction) {
    const user1 = interaction.options.getUser("usuario1");
    const user2 = interaction.options.getUser("usuario2");

    if (user1.id === user2.id) {
      return interaction.reply({
        content: "😅 Você não pode se shipar consigo mesmo!",
        ephemeral: true
      });
    }

    const love = Math.floor(Math.random() * 101);
    const shipName = user1.username.slice(0, user1.username.length / 2) +
                     user2.username.slice(user2.username.length / 2);

    // Emojis por afinidade
    let emoji = "";
    let frase = "";

    if (love >= 90) {
      emoji = "<:eg_heart:1353597127091294208>";
      frase = "💍 Casamento confirmado! se quiser use </casar\> e escolha o seu ship.";
    } else if (love >= 70) {
      emoji = "<a:estrela:1353898619731968050>";
      frase = "✨ Um casal brilhante! da pra ir um casamento hein <:eg_fire:1353597119436685354>";
    } else if (love >= 50) {
      emoji = "<:eg_fire:1353597119436685354>";
      frase = "🔥 Tem química, hein!";
    } else if (love >= 30) {
      emoji = "<:eg_netual:1353597145646759986>";
      frase = "🤔 Melhor só amizade mesmo...";
    } else {
      emoji = "<:icons_wrong:1353597190920212573>";
      frase = "💔 Sai que é cilada!";
    }

    // Criação da imagem
    const canvas = createCanvas(700, 300);
    const ctx = canvas.getContext("2d");

    // Fundo
    ctx.fillStyle = "#ffe4ec";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      const avatar1 = await loadImage(user1.displayAvatarURL({ format: "png", size: 256, forceStatic: true }));
      const avatar2 = await loadImage(user2.displayAvatarURL({ format: "png", size: 256, forceStatic: true }));

      // Avatar 1
      ctx.save();
      ctx.beginPath();
      ctx.arc(175, 150, 100, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar1, 75, 50, 200, 200);
      ctx.restore();

      // Avatar 2
      ctx.save();
      ctx.beginPath();
      ctx.arc(525, 150, 100, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar2, 425, 50, 200, 200);
      ctx.restore();

      // Emoji no meio
      ctx.font = "50px Sans";
      ctx.fillText("❤️", 325, 175);

      // Nome do casal
      ctx.fillStyle = "#000";
      ctx.font = "30px Sans";
      ctx.fillText(shipName, 280, 260);

      // Buffer final
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, { name: "ship.png" });

      // Embed
      const embed = new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle("💘 Resultado do Ship")
        .setDescription(`${emoji} ${user1} + ${user2} = **${shipName}**\n\n❤️ Afinidade: **${love}%**\n${frase}`)
        .setImage("attachment://ship.png")
        .setFooter({ text: `Comando usado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

      await interaction.reply({ embeds: [embed], files: [attachment] });

    } catch (err) {
      console.error("Erro ao gerar imagem do ship:", err);
      return interaction.reply({
        content: "❌ Ocorreu um erro ao gerar a imagem. Tente novamente mais tarde.",
        ephemeral: true
      });
    }
  }
};
