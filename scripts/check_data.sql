-- Check what is actually in the Vesper database.
--   psql -d vesper_hackathon -f scripts/check_data.sql
-- Every query here is read-only.

-- 1. Row counts across the seeded tables. The quickest "did the seed work" answer.
SELECT 'property.properties'     AS tbl, count(*) FROM property.properties
UNION ALL SELECT 'property.rooms',                 count(*) FROM property.rooms
UNION ALL SELECT 'property.room_categories',       count(*) FROM property.room_categories
UNION ALL SELECT 'property.departments',           count(*) FROM property.departments
UNION ALL SELECT 'property.assets',                count(*) FROM property.assets
UNION ALL SELECT 'property.sensor_readings',       count(*) FROM property.sensor_readings
UNION ALL SELECT 'identity.users',                 count(*) FROM identity.users
UNION ALL SELECT 'guest.guests',                   count(*) FROM guest.guests
UNION ALL SELECT 'guest.menu_items',               count(*) FROM guest.menu_items
UNION ALL SELECT 'guest.service_requests',         count(*) FROM guest.service_requests
UNION ALL SELECT 'frontdesk.bookings',             count(*) FROM frontdesk.bookings
UNION ALL SELECT 'frontdesk.stays',                count(*) FROM frontdesk.stays
UNION ALL SELECT 'frontdesk.guest_visits',         count(*) FROM frontdesk.guest_visits
UNION ALL SELECT 'inventory.stock_items',          count(*) FROM inventory.stock_items
UNION ALL SELECT 'revenue.competitor_rates',       count(*) FROM revenue.competitor_rates
UNION ALL SELECT 'revenue.demand_forecasts',       count(*) FROM revenue.demand_forecasts
UNION ALL SELECT 'guest_intel.knowledge_passages', count(*) FROM guest_intel.knowledge_passages
UNION ALL SELECT 'action.action_cards',            count(*) FROM action.action_cards
ORDER BY 1;

-- 2. Did the seed accidentally duplicate base data? A normal rerun is additive only
--    for missing workflow rows; properties must be 1 and each pair should match.
SELECT (SELECT count(*) FROM property.properties)            AS properties,
       (SELECT count(*) FROM identity.users)                 AS users,
       (SELECT count(DISTINCT email) FROM identity.users)    AS distinct_emails,
       (SELECT count(*) FROM property.rooms)                 AS rooms,
       (SELECT count(DISTINCT number) FROM property.rooms)   AS distinct_room_numbers;

-- 3. The room board, the way the housekeeping screen sees it.
SELECT rc.name AS category, r.status, count(*) AS rooms
FROM property.rooms r
JOIN property.room_categories rc ON rc.id = r.category_id
GROUP BY rc.name, r.status
ORDER BY rc.name, r.status;

-- 4. Who exists, by role and department. `role` is a FK to identity.roles, not a column.
SELECT ro.key AS role, coalesce(d.name, '-') AS department, count(*) AS people
FROM identity.users u
JOIN identity.roles ro ON ro.id = u.role_id
LEFT JOIN property.departments d ON d.id = u.department_id
GROUP BY ro.key, d.name
ORDER BY people DESC;

-- 5. The accounts worth demoing with. Password for all of them: vesper123
SELECT u.email, ro.key AS role, u.full_name
FROM identity.users u
JOIN identity.roles ro ON ro.id = u.role_id
WHERE u.email IN ('owner@vesper.demo','gm@vesper.demo','fom@vesper.demo',
                  'exec@vesper.demo','chef@vesper.demo','hk1@vesper.demo')
ORDER BY u.email;

-- 6. Who is in the building right now, and arriving/leaving today.
SELECT status, count(*) FROM frontdesk.stays GROUP BY status ORDER BY 2 DESC;

-- 7. Has the revenue engine produced a forecast yet? Empty on a fresh seed until the
--    scheduled refit runs, or until you POST /revenue/forecast/refresh.
SELECT stay_date, round(predicted_occupancy::numeric, 4) AS occupancy, model_name
FROM revenue.demand_forecasts
ORDER BY stay_date
LIMIT 10;
