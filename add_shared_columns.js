const { Client } = require('pg');
const c = new Client({connectionString:'postgresql://postgres:postgres@localhost:5433/sales_behavior'});
c.connect()
.then(()=>c.query(`
  ALTER TABLE journals ADD COLUMN IF NOT EXISTS awareness_shared boolean DEFAULT false;
  ALTER TABLE journals ADD COLUMN IF NOT EXISTS standards_shared boolean DEFAULT false;
  ALTER TABLE behavior_checklist_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE mindset_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE sales_activity_reports ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE end_of_day_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE phase_3_standard_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE belief_transformation_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE income_breakthrough_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
  ALTER TABLE career_commitment_logs ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
`))
.then(()=>console.log('done'))
.catch(console.error)
.finally(()=>c.end())