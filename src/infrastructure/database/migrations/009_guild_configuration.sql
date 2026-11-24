CREATE TABLE IF NOT EXISTS guild_configuration (
  guild_id VARCHAR(20) PRIMARY KEY,
  locale ENUM('pt-BR','en-US') NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
CREATE TABLE IF NOT EXISTS guild_locale_changes (
  guild_id VARCHAR(20) NOT NULL,
  revision INT UNSIGNED NOT NULL,
  actor_id VARCHAR(20) NOT NULL,
  previous_locale ENUM('pt-BR','en-US') NOT NULL,
  locale ENUM('pt-BR','en-US') NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, revision),
  FOREIGN KEY (guild_id) REFERENCES guild_configuration(guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
