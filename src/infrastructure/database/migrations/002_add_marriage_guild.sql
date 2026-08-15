ALTER TABLE casamentos
  ADD COLUMN guild_id VARCHAR(20) NULL AFTER id,
  ADD KEY idx_casamentos_guild_data (guild_id, data);
