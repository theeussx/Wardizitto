const mysql = require("mysql2/promise");
const config = require("../config.json");

async function initMariaDB() {
  try {
    const pool = mysql.createPool({
      host: config.mariaDB.host,
      user: config.mariaDB.user,
      password: config.mariaDB.password,
      database: config.mariaDB.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log("🔄 Conectando ao MariaDB...");

      
    await pool.query(`
CREATE TABLE IF NOT EXISTS hosted_bots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id VARCHAR(32) NOT NULL,
  bot_name VARCHAR(64) NOT NULL,
  dir_name VARCHAR(191) NOT NULL UNIQUE,
  token_enc TEXT NOT NULL,
  status ENUM('ONLINE','OFFLINE','ERROR') DEFAULT 'OFFLINE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);
    console.log("tabela host criada");
    // 📝 Tabela de Casamentos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        parceiro_id VARCHAR(20) NOT NULL,
        data BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'casamentos' criada/verificada com sucesso!");

    // 🧠 Tabela de Gêneros
    await pool.query(`
      CREATE TABLE IF NOT EXISTS generos (
        user_id VARCHAR(20) PRIMARY KEY,
        genero ENUM('masculino', 'feminino') NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'gêneros' criada/verificada com sucesso!");

    // 🕓 Tabela de AFK Status
    await pool.query(`
      CREATE TABLE IF NOT EXISTS afk_status (
        user_id VARCHAR(20) PRIMARY KEY,
        mensagem TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'afk_status' criada/verificada com sucesso!");

    // ⚠️ Tabela de Avisos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    moderator_id VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);
    console.log("✅ Tabela 'arnings' criada/verificada com sucesso!");

    // 💰 Tabela de Economia - Usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economia_usuarios (
        user_id VARCHAR(20) PRIMARY KEY,
        carteira INT DEFAULT 0,
        banco INT DEFAULT 0,
        ultima_daily DATETIME DEFAULT NULL,
        ultima_trabalhar DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_usuarios' criada/verificada com sucesso!");

    // 💼 Tabela de Economia - Profissões
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economia_profissoes (
        user_id VARCHAR(20) PRIMARY KEY,
        profissao VARCHAR(100) DEFAULT 'Nenhuma'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_profissoes' criada/verificada com sucesso!");

    // 🛍️ Tabela de Economia - Loja
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economia_loja (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_nome VARCHAR(100) NOT NULL,
        preco INT NOT NULL,
        descricao TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_loja' criada/verificada com sucesso!");

    // 🎒 Tabela de Economia - Inventário
    await pool.query(`
      CREATE TABLE IF NOT EXISTS economia_inventario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        item_id INT NOT NULL,
        quantidade INT DEFAULT 1,
        FOREIGN KEY (item_id) REFERENCES economia_loja(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'economia_inventario' criada/verificada com sucesso!");

    // 📊 Tabela de Estatísticas - bot_stats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_stats (
        user_id VARCHAR(20) PRIMARY KEY,
        wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        losses INT DEFAULT 0,
        total INT DEFAULT 0,
        facil_wins INT DEFAULT 0,
        facil_draws INT DEFAULT 0,
        facil_losses INT DEFAULT 0,
        medio_wins INT DEFAULT 0,
        medio_draws INT DEFAULT 0,
        medio_losses INT DEFAULT 0,
        dificil_wins INT DEFAULT 0,
        dificil_draws INT DEFAULT 0,
        dificil_losses INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'bot_stats' criada/verificada com sucesso!");

    // ⚔️ Tabela de Estatísticas - uvs_stats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS uvs_stats (
        user_id VARCHAR(20) PRIMARY KEY,
        wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        losses INT DEFAULT 0,
        total INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'uvs_stats' criada/verificada com sucesso!");

    // 🎟️ Tabela principal de configuração de tickets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        category_id VARCHAR(20) NOT NULL,
        staff_role_id VARCHAR(20) NOT NULL,
        log_channel_id VARCHAR(20) NOT NULL,
        panel_channel_id VARCHAR(20),
        open_message TEXT,
        close_message TEXT,
        generate_transcript BOOLEAN DEFAULT TRUE,
        ticket_limit INT DEFAULT 3,
        channel_prefix VARCHAR(50) DEFAULT 'ticket',
        configured_by VARCHAR(20) NOT NULL,
        configured_at BIGINT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'ticket_config' criada/verificada com sucesso!");

    // 📁 Tabela de tickets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(20) PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        user_tag VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        opened_at BIGINT NOT NULL,
        closed_at BIGINT,
        closed_by VARCHAR(20),
        status ENUM('open', 'closed', 'archived', 'locked') DEFAULT 'open',
        guild_id VARCHAR(20) NOT NULL,
        locked_by VARCHAR(20),
        locked_at BIGINT,
        archived_by VARCHAR(20),
        archived_at BIGINT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'tickets' criada/verificada com sucesso!");

    // 👥 Tabela de relacionamento usuário-ticket
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_tickets (
        user_id VARCHAR(20) NOT NULL,
        ticket_id VARCHAR(20) NOT NULL,
        status ENUM('open', 'closed', 'archived', 'locked') DEFAULT 'open',
        opened_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, ticket_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'user_tickets' criada/verificada com sucesso!");

    // 🕓 Histórico de tickets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        user_tag VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        opened_at BIGINT NOT NULL,
        closed_at BIGINT NOT NULL,
        closed_by VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'ticket_history' criada/verificada com sucesso!");

    // 🎟️ Tabela de Enquetes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS polls (
        message_id VARCHAR(20) PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        title TEXT NOT NULL,
        options JSON NOT NULL,
        votes JSON NOT NULL,
        voters JSON DEFAULT NULL,
        unique_vote BOOLEAN DEFAULT TRUE,
        embed_color VARCHAR(7) DEFAULT '#0099ff',
        embed_footer TEXT,
        duration INT,
        created_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'polls' criada/verificada com sucesso!");

    // 🔢 Tabela de Contagens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contagens (
        guild_id VARCHAR(20) PRIMARY KEY,
        canal_id VARCHAR(20) NOT NULL,
        ultima_contagem INT DEFAULT 0,
        ativo BOOLEAN DEFAULT FALSE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'contagens' criada/verificada com sucesso!");

    // 📝 Tabela de Configuração de Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        log_channel_id VARCHAR(20) DEFAULT NULL,
        log_message_delete BOOLEAN DEFAULT 0,
        log_message_edit BOOLEAN DEFAULT 0,
        log_member_join BOOLEAN DEFAULT 0,
        log_member_leave BOOLEAN DEFAULT 0,
        log_ban_add BOOLEAN DEFAULT 0,
        log_ban_remove BOOLEAN DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabela 'logs_config' criada/verificada com sucesso!");

    return pool;
  } catch (error) {
    console.error("❌ Erro ao iniciar o MariaDB:", error);
    process.exit(1);
  }
}

module.exports = { initMariaDB };