UPDATE app_settings
SET value = jsonb_set(value, '{shodan,apiKey}', '""'::jsonb, false)
WHERE key = 'integrations'
  AND value -> 'shodan' ->> 'apiKey' IS NOT NULL
  AND length(value -> 'shodan' ->> 'apiKey') <= 10;