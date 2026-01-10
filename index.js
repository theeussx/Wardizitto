const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config.json');
const { pool } = require('./handlers/db');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

// Verificações básicas
if (!config.token) {
  console.error("❌ ERRO: Token do bot não foi definido no config.json!");
  process.exit(1);
}

if (!config.MySQL || !config.MySQL.host || !config.MySQL.user || !config.MySQL.password || !config.MySQL.database) {
  console.error("❌ ERRO: Configuração do MySQL não foi definida no config.json!");
  process.exit(1);
}

// Cria o client do bot com intents essenciais
const client = new Client({
  intents: Object.values(GatewayIntentBits),
});

client.commands = new Collection();
client.MySQL = pool;

// Inicia o bot
async function start() {
  try {
    console.log('✅ Conectado ao MySQL!');
    commandHandler(client);
    eventHandler(client);
    await client.login(config.token);
  } catch (err) {
    console.error('❌ Erro ao iniciar o bot:', err);
    process.exit(1);
  }
}

start();

// Mensagem ao iniciar
client.on('ready', () => {
  console.log(`🤖 Bot online: ${client.user.tag}`);
});

// Exporta o client
module.exports = client;