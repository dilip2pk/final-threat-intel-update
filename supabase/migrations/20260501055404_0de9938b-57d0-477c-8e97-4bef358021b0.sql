UPDATE app_settings
SET value = jsonb_set(value, '{shodan,apiKey}', '"jYU3p0ITaGLZ0Q3ttdCmWD7oU2RoA9rO"'::jsonb, true)
WHERE key = 'integrations';

INSERT INTO app_settings (key, value)
SELECT 'integrations', jsonb_build_object('shodan', jsonb_build_object('apiKey', 'jYU3p0ITaGLZ0Q3ttdCmWD7oU2RoA9rO', 'enabled', true))
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'integrations');