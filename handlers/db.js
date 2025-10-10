const mysql = require("mysql2/promise");
const config = require("../config.json");
const path = require("path");

// Cria o pool de conexões com o MariaDB
const pool = mysql.createPool({
  host: config.mariaDB.host,
  user: config.mariaDB.user,
  password: config.mariaDB.password,
  database: config.mariaDB.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Função para realizar consultas no MariaDB
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error("❌ Erro ao executar a consulta no MariaDB:", error);
    throw error; // Repassa o erro para o comando chamar
  }
}

// Inicializa a criação das tabelas automaticamente lendo o módulo models/mariadb.js
const { initMariaDB } = require("../models/mariadb.js");
initMariaDB();

// Exporta o pool e a função query para uso em outros módulos
module.exports = { pool, query };