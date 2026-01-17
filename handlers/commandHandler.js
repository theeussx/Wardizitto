const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

module.exports = (client) => {
  client.commands = new Collection();
  client.prefixCommands = new Collection();

  // 🔁 Função recursiva para carregar comandos Slash
  const loadSlashCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        loadSlashCommands(filePath);
      } else if (file.endsWith('.js')) {
        try {
          const command = require(filePath);
          if (command?.data && typeof command.execute === 'function') {
            client.commands.set(command.data.name, command);
            console.log(`✅ Slash Command carregado: ${command.data.name}`);
          }
        } catch (err) {
          console.error(`❌ Erro ao carregar Slash Command ${file}:`, err);
        }
      }
    }
  };

  // 🔁 Função recursiva para carregar comandos de Prefixo
  const loadPrefixCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        loadPrefixCommands(filePath);
      } else if (file.endsWith('.js')) {
        try {
          const command = require(filePath);
          if (command?.name && typeof command.run === 'function') {
            client.prefixCommands.set(command.name, command);
            console.log(`✅ Comando de Prefixo carregado: ${command.name}`);
          }
        } catch (err) {
          console.error(`❌ Erro ao carregar comando de Prefixo ${file}:`, err);
        }
      }
    }
  };

  // Carrega os comandos das novas pastas
  loadSlashCommands(path.join(__dirname, '../commands/Slash'));
  loadPrefixCommands(path.join(__dirname, '../commands/Prefix'));

  // Registra os Slash Commands no Discord ao iniciar
  client.once('ready', async () => {
    try {
      const isGlobal = process.env.GLOBAL_SLASH === 'true';
      const guildId = process.env.GUILD_ID;

      const slashCommands = client.commands.map(cmd => cmd.data.toJSON());

      if (isGlobal) {
        console.log('🔄 Registrando Slash Commands GLOBALMENTE...');
        await client.application.commands.set(slashCommands);
        console.log(`✅ ${slashCommands.length} Slash Commands registrados globalmente.`);
      } else if (guildId && guildId !== 'SEU_ID_DO_SERVIDOR_AQUI') {
        console.log(`🔄 Registrando Slash Commands LOCALMENTE no servidor: ${guildId}`);
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          await guild.commands.set(slashCommands);
          console.log(`✅ ${slashCommands.length} Slash Commands registrados localmente.`);
        } else {
          console.error('❌ Servidor para registro local não encontrado. Verifique o GUILD_ID no .env');
        }
      } else {
        console.warn('⚠️ Registro de Slash Commands ignorado: GLOBAL_SLASH é false e GUILD_ID não configurado.');
      }
    } catch (err) {
      console.error('❌ Erro ao registrar Slash Commands:', err);
    }
  });
};
