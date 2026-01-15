const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config({
  path: process.env.NODE_ENV === 'dev' ? '.env.dev' : '.env'
});
const { pool } = require('./handlers/db');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

// Verificações básicas
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ ERRO: DISCORD_TOKEN não foi definido no arquivo .env!");
  process.exit(1);
}

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error("❌ ERRO: Configurações do Banco de Dados não foram definidas no arquivo .env!");
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
    await client.login(token);
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