DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PROVINCIAL_VIEWER'
      AND enumtypid = 'users_role_enum'::regtype
  ) THEN
    ALTER TYPE users_role_enum ADD VALUE 'PROVINCIAL_VIEWER';
  END IF;
END $$;
