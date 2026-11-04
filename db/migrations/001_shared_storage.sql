CREATE SEQUENCE incident_record_number;

CREATE TABLE incident_records (
  id text PRIMARY KEY DEFAULT ('R-' || nextval('incident_record_number')::text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under review', 'Closed')),
  event_date date NOT NULL,
  event_time text NOT NULL DEFAULT '' CHECK (event_time = '' OR event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text NOT NULL CHECK (location IN ('Central storeroom','Loading dock','Maintenance shop','Grounds','Inside a campus building','Roadway or parking','Office')),
  building_name text NOT NULL DEFAULT '' CHECK (length(building_name) <= 80),
  shift text NOT NULL CHECK (shift IN ('Day','Evening','Night')),
  event_type text NOT NULL CHECK (event_type IN ('Injury','Near miss','Property damage','Unsafe condition')),
  severity text NOT NULL CHECK (severity IN ('None','First aid only','Medical treatment','Days away from work','Hospitalization')),
  days_away integer,
  equipment text NOT NULL CHECK (equipment IN ('Forklift','Pallet jack','Utility vehicle or cart','Ladder','Power tool','Hand tool','None')),
  description text NOT NULL CHECK (length(description) BETWEEN 20 AND 2000),
  immediate_action text NOT NULL DEFAULT '' CHECK (length(immediate_action) <= 1000),
  reporter_name text NOT NULL CHECK (length(reporter_name) BETWEEN 2 AND 80),
  reporter_email text NOT NULL CHECK (length(reporter_email) BETWEEN 3 AND 254),
  CHECK (event_type NOT IN ('Near miss','Unsafe condition') OR severity = 'None'),
  CHECK ((severity = 'Days away from work' AND days_away IS NOT NULL AND days_away BETWEEN 1 AND 180)
      OR (severity <> 'Days away from work' AND days_away IS NULL)),
  CHECK (location <> 'Inside a campus building' OR length(building_name) >= 2)
);
CREATE INDEX incident_records_date_idx ON incident_records (event_date DESC);

CREATE TABLE record_batches (
  id uuid PRIMARY KEY,
  payload_hash text NOT NULL,
  record_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
  answered boolean NOT NULL,
  asked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_log_date_idx ON question_log (asked_at);

CREATE TABLE demo_seed_runs (
  name text PRIMARY KEY,
  seeded_at timestamptz NOT NULL DEFAULT now()
);
