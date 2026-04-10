DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_activity_reports_user_id_log_date_key'
  ) THEN
    ALTER TABLE sales_activity_reports DROP CONSTRAINT sales_activity_reports_user_id_log_date_key;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'belief_transformation_logs_user_id_log_date_key'
  ) THEN
    ALTER TABLE belief_transformation_logs DROP CONSTRAINT belief_transformation_logs_user_id_log_date_key;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_activity_reports_user_date
ON sales_activity_reports (user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_belief_transformation_logs_user_date
ON belief_transformation_logs (user_id, log_date);
