const { 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    ActionRowBuilder,
    SeparatorBuilder 
} = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "ajuda",
    description: "Central de ajuda interativa para comandos do bot.",
    run: async (client, message) => {
        const rootDir = process.cwd();
        
        // --- CONFIGURAÇÃO: Pastas bloqueadas ---
        const blockedCategories = ["dono"];

        const createHome = () => {
            return new ContainerBuilder()
                .setAccentColor(0x5865F2)
                .addTextDisplayComponents(t => t.setContent("## 💠 Central de Comandos — Wardizitto\n> Selecione uma interface abaixo para navegar entre os comandos disponíveis."))
                .addSeparatorComponents(new SeparatorBuilder())
                .addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("✨ **integração de comandos prefixo**\nComandos via prefixo."))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("list_prefix").setLabel("Acessar").setStyle(ButtonStyle.Primary))
                )
                .addSectionComponents(s => s
                    .addTextDisplayComponents(t => t.setContent("🚀 **Integração de comandos Slash**\nComandos nativos de última geração."))
                    .setButtonAccessory(new ButtonBuilder().setCustomId("list_slash").setLabel("Acessar").setStyle(ButtonStyle.Success))
                );
        };

        const msg = await message.reply({ 
            components: [createHome()], 
            flags: [MessageFlags.IsComponentsV2] 
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 300000
        });

        collector.on("collect", async (i) => {
            
    
            if (i.customId === "list_prefix" || i.customId === "list_slash") {
                const isPrefix = i.customId === "list_prefix";
                const typePath = isPrefix ? "Prefix" : "Slash";
                const basePath = path.join(rootDir, "commands", typePath);

                if (!fs.existsSync(basePath)) return i.reply({ content: "❌ Falha crítica: Diretório não mapeado.", ephemeral: true });

                
                const categories = fs.readdirSync(basePath)
                    .filter(f => fs.statSync(path.join(basePath, f)).isDirectory())
                    .filter(cat => !blockedCategories.includes(cat.toLowerCase()));
                
                const catContainer = new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(t => t.setContent(`### 📂 Comandos Disponíveis — ${isPrefix ? "Prefixo" : "Slash"}\nEscolha uma categoria para listar os comandos:`));

                categories.forEach(cat => {
                    catContainer.addSectionComponents(s => s
                        .addTextDisplayComponents(t => t.setContent(`📦 **${cat.toUpperCase()}**\n*Categoria de comandos de ${cat}*`))
                        .setButtonAccessory(new ButtonBuilder()
                            .setCustomId(`view_${isPrefix ? "p" : "s"}_${cat}`)
                            .setLabel("Listar")
                            .setStyle(ButtonStyle.Secondary))
                    );
                });

                const backRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("go_home").setLabel("Menu Inicial").setStyle(ButtonStyle.Secondary).setEmoji("🏠")
                );

                await i.update({ components: [catContainer, backRow] });
            }

            
            if (i.customId.startsWith("view_")) {
                const [_, type, category] = i.customId.split("_");
                const isPrefix = type === "p";
                
                const cmdSource = isPrefix ? client.prefixCommands : client.commands;
                const commands = cmdSource.filter(c => (c.category || "").toLowerCase() === category.toLowerCase());

                const cmdContainer = new ContainerBuilder()
                    .setAccentColor(0xEB459E)
                    .addTextDisplayComponents(t => t.setContent(`### 📄 comandos: ${category.toUpperCase()}`))
                    .addSeparatorComponents(new SeparatorBuilder());

                if (commands.size === 0) {
                    cmdContainer.addTextDisplayComponents(t => t.setContent("> ℹ️ _Nenhuma entrada de comando encontrada neste setor._"));
                } else {
                    const commandList = commands.map(c => {
                        const name = isPrefix ? c.name : c.data.name;
                        const desc = isPrefix ? c.description : c.data.description;
                        return `**\`${isPrefix ? '!' : '/'}${name}\`**\n> ${desc || "Descrição pendente no arquivo."}`;
                    }).join("\n\n");

                    cmdContainer.addTextDisplayComponents(t => t.setContent(commandList));
                }

                const footerRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(isPrefix ? "list_prefix" : "list_slash").setLabel("Voltar").setEmoji("⬅️").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("go_home").setLabel("Sair").setStyle(ButtonStyle.Danger)
                );

                await i.update({ components: [cmdContainer, footerRow] });
            }

            if (i.customId === "go_home") {
                await i.update({ components: [createHome()] });
            }
        });

        collector.on("end", () => {
            msg.edit({ components: [] }).catch(() => {});
        });
    }
};
