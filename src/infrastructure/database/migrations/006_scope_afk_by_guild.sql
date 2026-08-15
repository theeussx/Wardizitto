ALTER TABLE afk_status
  ADD COLUMN guild_id VARCHAR(20) NOT NULL DEFAULT '' FIRST,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (guild_id, user_id),
  ADD KEY idx_afk_user (user_id);
