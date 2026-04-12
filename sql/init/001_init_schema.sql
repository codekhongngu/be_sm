DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
    CREATE TYPE users_role_enum AS ENUM ('EMPLOYEE', 'MANAGER', 'PROVINCIAL_VIEWER', 'ADMIN');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  "telegramGroupChatId" varchar,
  "parentUnitId" uuid REFERENCES units(id) ON DELETE SET NULL,
  "isActive" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_units_parent_unit_id ON units("parentUnitId");

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar NOT NULL UNIQUE,
  password varchar NOT NULL,
  "fullName" varchar NOT NULL,
  "unitId" uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  role users_role_enum NOT NULL DEFAULT 'EMPLOYEE',
  "telegramChatId" varchar
);

CREATE TABLE IF NOT EXISTS journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "reportDate" date NOT NULL DEFAULT CURRENT_DATE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  avoidance text NOT NULL DEFAULT '',
  "selfLimit" text NOT NULL DEFAULT '',
  "earlyStop" text NOT NULL DEFAULT '',
  blaming text NOT NULL DEFAULT '',
  "standardsKept" jsonb NOT NULL DEFAULT '{"deepInquiry":false,"fullConsult":false,"persistence":false}',
  "standardsKeptText" text NOT NULL DEFAULT '',
  "backslideSigns" text NOT NULL DEFAULT '',
  solution text NOT NULL DEFAULT '',
  "awarenessSubmittedAt" timestamptz,
  "standardsSubmittedAt" timestamptz,
  "awarenessUpdateCount" integer NOT NULL DEFAULT 0,
  "standardsUpdateCount" integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_journals_user_report_date UNIQUE ("userId", "reportDate")
);

CREATE TABLE IF NOT EXISTS journal_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journalId" uuid NOT NULL UNIQUE REFERENCES journals(id) ON DELETE CASCADE,
  "avoidanceNote" text NOT NULL,
  "selfLimitNote" text NOT NULL,
  "earlyStopNote" text NOT NULL,
  "blamingNote" text NOT NULL,
  "hasAvoidance" boolean NOT NULL DEFAULT false,
  "hasSelfLimit" boolean NOT NULL DEFAULT false,
  "hasEarlyStop" boolean NOT NULL DEFAULT false,
  "hasBlaming" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflections_journal_id
  ON journal_reflections("journalId");

CREATE TABLE IF NOT EXISTS journal_high_income_eforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journalId" uuid NOT NULL UNIQUE REFERENCES journals(id) ON DELETE CASCADE,
  "keptStandardsAnswer" text NOT NULL,
  "declineSignsAnswer" text NOT NULL,
  "handlingPlanAnswer" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_high_income_eforms_journal_id
  ON journal_high_income_eforms("journalId");

CREATE INDEX IF NOT EXISTS idx_users_unit_id ON users("unitId");
CREATE INDEX IF NOT EXISTS idx_journals_user_id ON journals("userId");
CREATE INDEX IF NOT EXISTS idx_journals_created_at ON journals("createdAt");
CREATE INDEX IF NOT EXISTS idx_journals_report_date ON journals("reportDate");

CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journalId" uuid NOT NULL UNIQUE REFERENCES journals(id) ON DELETE CASCADE,
  "managerId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "deepInquiryStatus" boolean NOT NULL DEFAULT false,
  "fullProposalStatus" boolean NOT NULL DEFAULT false,
  "persistenceStatus" boolean NOT NULL DEFAULT false,
  "deepInquiryNote" text,
  "fullProposalNote" text,
  "persistenceNote" text,
  "awarenessReviewed" boolean NOT NULL DEFAULT false,
  "awarenessDeepInquiryStatus" boolean NOT NULL DEFAULT false,
  "awarenessFullProposalStatus" boolean NOT NULL DEFAULT false,
  "awarenessPersistenceStatus" boolean NOT NULL DEFAULT false,
  "awarenessDeepInquiryNote" text,
  "awarenessFullProposalNote" text,
  "awarenessPersistenceNote" text,
  "standardsReviewed" boolean NOT NULL DEFAULT false,
  "awarenessManagerNote" text,
  "standardsManagerNote" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_manager_id ON evaluations("managerId");

CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
