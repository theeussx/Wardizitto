ALTER TABLE tickets
  ADD COLUMN claimed_by VARCHAR(20) NULL AFTER closed_by;
