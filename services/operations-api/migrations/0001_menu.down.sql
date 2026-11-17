-- Non-production rollback only.
DROP TABLE IF EXISTS audit_log;
DROP FUNCTION IF EXISTS audit_log_append_only();
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menu_sections;
DROP TABLE IF EXISTS restaurant_managers;
DROP TABLE IF EXISTS restaurants;
