CREATE TABLE IF NOT EXISTS marriage_members (
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  marriage_id INT NOT NULL,
  partner_id VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id),
  KEY idx_marriage_members_marriage (marriage_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- migrate:split
INSERT IGNORE INTO marriage_members (guild_id, user_id, marriage_id, partner_id)
SELECT guild_id, user_id, id, parceiro_id FROM casamentos WHERE guild_id IS NOT NULL;
-- migrate:split
INSERT IGNORE INTO marriage_members (guild_id, user_id, marriage_id, partner_id)
SELECT guild_id, parceiro_id, id, user_id FROM casamentos WHERE guild_id IS NOT NULL;
