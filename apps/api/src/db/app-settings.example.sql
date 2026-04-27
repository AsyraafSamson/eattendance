-- Populate these required settings after importing schema.sql.
-- Replace the placeholder values with environment-specific values before executing.

INSERT OR REPLACE INTO app_settings (key, value) VALUES
  ('office_name', '<office name>'),
  ('office_lat', '<office latitude>'),
  ('office_lng', '<office longitude>'),
  ('office_radius_meters', '<office radius meters>'),
  ('frontend_url', '<frontend base url>');
