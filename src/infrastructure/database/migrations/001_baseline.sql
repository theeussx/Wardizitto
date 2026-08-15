CREATE TABLE IF NOT EXISTS custom_permissions (
  guild_id VARCHAR(20) NOT NULL,
  subject_type ENUM('user', 'role') NOT NULL,
  subject_id VARCHAR(20) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, subject_type, subject_id, permission),
  KEY idx_custom_permissions_lookup (guild_id, permission, allowed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS casamentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  parceiro_id VARCHAR(20) NOT NULL,
  data BIGINT NOT NULL,
  KEY idx_casamentos_user (user_id),
  KEY idx_casamentos_partner (parceiro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS generos (
  user_id VARCHAR(20) PRIMARY KEY,
  genero ENUM('masculino', 'feminino') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS afk_status (
  user_id VARCHAR(20) PRIMARY KEY,
  mensagem VARCHAR(1000) NOT NULL,
  timestamp BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS warns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  moderator_id VARCHAR(20) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_warns_guild_user_date (guild_id, user_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS avisos (
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  quantidade INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS verified_users (
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  verificado BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id),
  KEY idx_verified_users_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS economia_usuarios (
  user_id VARCHAR(20) PRIMARY KEY,
  carteira BIGINT NOT NULL DEFAULT 0,
  banco BIGINT NOT NULL DEFAULT 0,
  ultima_daily DATETIME(3) NULL,
  ultima_trabalhar DATETIME(3) NULL,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  level INT UNSIGNED NOT NULL DEFAULT 1,
  apostas_count INT UNSIGNED NOT NULL DEFAULT 0,
  ultima_aposta_reset TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  jkp_bot_count INT UNSIGNED NOT NULL DEFAULT 0,
  jkp_player_count INT UNSIGNED NOT NULL DEFAULT 0,
  ultima_jkp_reset TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sobre_mim VARCHAR(255) NOT NULL DEFAULT 'Use /sobre para mudar isso!',
  CONSTRAINT chk_economia_wallet CHECK (carteira >= 0),
  CONSTRAINT chk_economia_bank CHECK (banco >= 0),
  CONSTRAINT chk_economia_level CHECK (level >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS economia_profissoes (
  user_id VARCHAR(20) PRIMARY KEY,
  profissao VARCHAR(100) NOT NULL DEFAULT 'Nenhuma'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS economia_loja (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_nome VARCHAR(100) NOT NULL,
  preco BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(1000) NULL,
  tipo ENUM('role', 'item', 'background') NOT NULL DEFAULT 'item',
  valor_extra VARCHAR(255) NULL,
  disponivel_web BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_economia_loja_available (disponivel_web, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS economia_inventario (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_inventory_owner_item (guild_id, user_id, item_id),
  KEY idx_inventory_user_guild (user_id, guild_id),
  CONSTRAINT fk_inventory_item FOREIGN KEY (item_id) REFERENCES economia_loja(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS economy_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  counterparty_id VARCHAR(20) NULL,
  guild_id VARCHAR(20) NULL,
  kind VARCHAR(50) NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT NULL,
  idempotency_key VARCHAR(100) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_economy_transaction_idempotency (idempotency_key),
  KEY idx_economy_transaction_user_created (user_id, created_at),
  KEY idx_economy_transaction_guild_created (guild_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS bot_stats (
  user_id VARCHAR(20) PRIMARY KEY,
  wins INT UNSIGNED NOT NULL DEFAULT 0,
  draws INT UNSIGNED NOT NULL DEFAULT 0,
  losses INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  facil_wins INT UNSIGNED NOT NULL DEFAULT 0,
  facil_draws INT UNSIGNED NOT NULL DEFAULT 0,
  facil_losses INT UNSIGNED NOT NULL DEFAULT 0,
  medio_wins INT UNSIGNED NOT NULL DEFAULT 0,
  medio_draws INT UNSIGNED NOT NULL DEFAULT 0,
  medio_losses INT UNSIGNED NOT NULL DEFAULT 0,
  dificil_wins INT UNSIGNED NOT NULL DEFAULT 0,
  dificil_draws INT UNSIGNED NOT NULL DEFAULT 0,
  dificil_losses INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS uvs_stats (
  user_id VARCHAR(20) PRIMARY KEY,
  wins INT UNSIGNED NOT NULL DEFAULT 0,
  draws INT UNSIGNED NOT NULL DEFAULT 0,
  losses INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS polls (
  message_id VARCHAR(20) PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  options JSON NOT NULL,
  votes JSON NOT NULL,
  voters JSON NULL,
  unique_vote BOOLEAN NOT NULL DEFAULT TRUE,
  embed_color CHAR(7) NOT NULL DEFAULT '#0099ff',
  embed_footer VARCHAR(500) NULL,
  duration INT UNSIGNED NULL,
  created_at BIGINT NOT NULL,
  KEY idx_polls_guild_created (guild_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS contagens (
  guild_id VARCHAR(20) PRIMARY KEY,
  canal_id VARCHAR(20) NOT NULL,
  ultima_contagem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS tickets_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  category_id VARCHAR(20) NULL,
  support_role_id VARCHAR(20) NULL,
  logs_channel_id VARCHAR(20) NULL,
  panel_message_id VARCHAR(20) NULL,
  panel_channel_id VARCHAR(20) NULL,
  embed_title VARCHAR(255) NOT NULL DEFAULT '🎫 Central de Suporte',
  embed_description VARCHAR(2000) NULL,
  embed_color CHAR(7) NOT NULL DEFAULT '#2f3136',
  ticket_message VARCHAR(2000) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  closed_by VARCHAR(20) NULL,
  transcript_url VARCHAR(2048) NULL,
  UNIQUE KEY uq_tickets_channel (channel_id),
  KEY idx_tickets_guild_status (guild_id, status, created_at),
  KEY idx_tickets_user_status (guild_id, user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
