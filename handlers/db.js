const mysql = require("mysql2/promise");

// Cria o pool de conexões com o MySQL otimizado usando variáveis de ambiente
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
  waitForConnectionsMs: 5000,
  enableCloseOnExit: true
});

// Monitorar erros de conexão
pool.on('error', (err) => {
  console.error("❌ Erro no pool de conexões:", err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('⚠️ Conexão perdida, reconectando...');
  }
  if (err.code === 'PROTOCOL_ERROR') {
    console.log('⚠️ Erro de protocolo, reconectando...');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.log('⚠️ Muitas conexões, aguardando...');
  }
  if (err.code === 'ER_AUTHENTICATION_PLUGIN_ERROR') {
    console.log('❌ Erro de autenticação no banco de dados');
  }
});

// Função para realizar consultas no MySQL com retry automático
async function query(sql, params = []) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error("❌ Erro ao executar a consulta após 3 tentativas:", error.message);
        throw error;
      }
      console.warn(`⚠️ Erro na consulta, tentando novamente (${3 - retries}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 500)); //500 ms de espera antes de tentar novamente
    }
  }
}

// Inicializa as tabelas necessárias no banco de dados
async function initDatabase() {
  const { initMySQL } = require("../models/MySQL.js");
  await initMySQL(pool);
}

initDatabase();

// Exporta o pool e a função query para uso em outros módulos
module.exports = { pool, query };