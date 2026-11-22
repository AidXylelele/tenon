UPDATE "workflow_version" SET "schedule" = "schedule" || '{"types": []}'::jsonb WHERE "schedule"->>'kind' = 'on';
