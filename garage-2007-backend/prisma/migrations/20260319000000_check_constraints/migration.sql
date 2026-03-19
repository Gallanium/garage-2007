-- Check constraints for game_saves table
-- Prevents negative balances and counts at the database level

ALTER TABLE game_saves ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_nuts_non_negative CHECK (nuts >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_click_power_non_negative CHECK (click_power_level >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_work_speed_non_negative CHECK (work_speed_level >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_apprentice_non_negative CHECK (apprentice_count >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_mechanic_non_negative CHECK (mechanic_count >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_master_non_negative CHECK (master_count >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_brigadier_non_negative CHECK (brigadier_count >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_director_non_negative CHECK (director_count >= 0);
ALTER TABLE game_saves ADD CONSTRAINT chk_garage_level_positive CHECK (garage_level >= 1);
