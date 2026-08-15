UPDATE tickets duplicate_ticket
JOIN tickets keeper
  ON keeper.guild_id = duplicate_ticket.guild_id
 AND keeper.user_id = duplicate_ticket.user_id
 AND keeper.status = 'open'
 AND keeper.id < duplicate_ticket.id
SET duplicate_ticket.status = 'closed',
    duplicate_ticket.closed_at = CURRENT_TIMESTAMP
WHERE duplicate_ticket.status = 'open';
-- migrate:split
ALTER TABLE tickets
  ADD COLUMN open_user_key VARCHAR(41)
    GENERATED ALWAYS AS (
      CASE WHEN status = 'open' THEN CONCAT(guild_id, ':', user_id) ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_tickets_one_open_per_user (open_user_key);
