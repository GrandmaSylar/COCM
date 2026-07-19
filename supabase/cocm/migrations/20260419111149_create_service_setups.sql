CREATE TABLE service_setups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date        date NOT NULL,
  service_type        text NOT NULL,
  mc_member_id        uuid REFERENCES members(id),
  mc_name             text,
  time                text,
  sermon_topic        text,
  scripture_english   text,
  scripture_twi       text,
  preacher_member_id  uuid REFERENCES members(id),
  preacher_name       text,
  programme           jsonb NOT NULL DEFAULT '[]',
  officiators         jsonb NOT NULL DEFAULT '[]',
  created_by          uuid REFERENCES profiles(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (service_date, service_type)
);
