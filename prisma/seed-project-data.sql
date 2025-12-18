-- =====================================================
-- PROJECT DATABASE SEED DATA
-- =====================================================
-- This script seeds a single project database with test data
-- Run this for each project database (5 times total)
--
-- Usage (example for taskmanager_platform):
--   psql -h localhost -U postgres -d taskmanager_platform -f seed-project-data.sql
--
-- NOTE: Adjust user IDs based on which users have access to this project
-- =====================================================

-- =====================================================
-- 1. STATUS TYPES
-- =====================================================
INSERT INTO statustypes (stattype_typeid, stattype_description, stattype_created_at)
VALUES
  (1, 'To Do', NOW()),
  (2, 'In Progress', NOW()),
  (3, 'Done', NOW()),
  (4, 'In Review', NOW())
ON CONFLICT (stattype_typeid) DO NOTHING;

-- =====================================================
-- 2. COLUMNS (Kanban Board)
-- =====================================================
INSERT INTO columns (col_columnid, col_name, col_order, col_created_at)
VALUES
  ('10000001-0001-4001-8001-000000000001', 'To Do', 1, NOW()),
  ('20000002-0002-4002-8002-000000000002', 'In Progress', 2, NOW()),
  ('30000003-0003-4003-8003-000000000003', 'Review', 3, NOW()),
  ('40000004-0004-4004-8004-000000000004', 'Done', 4, NOW());

-- =====================================================
-- 3. STATUSES
-- =====================================================
INSERT INTO statuses (stat_statusid, stat_name, stat_typeid, stat_columnid, stat_created_at)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'To Do', 1, '10000001-0001-4001-8001-000000000001', NOW()),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'In Progress', 2, '20000002-0002-4002-8002-000000000002', NOW()),
  ('33333303-0003-4003-8003-000000000003', 'In Review', 2, '30000003-0003-4003-8003-000000000003', NOW()),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Done', 3, '40000004-0004-4004-8004-000000000004', NOW()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Planned', 1, '10000001-0001-4001-8001-000000000001', NOW()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Active', 2, '20000002-0002-4002-8002-000000000002', NOW()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Completed', 3, '40000004-0004-4004-8004-000000000004', NOW());

-- =====================================================
-- 4. STATUS TRANSITIONS (Workflow)
-- =====================================================
INSERT INTO status_transitions (st_id, st_from_statusid, st_to_statusid)
VALUES
  (gen_random_uuid(), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), -- To Do -> In Progress
  (gen_random_uuid(), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '33333303-0003-4003-8003-000000000003'), -- In Progress -> Review
  (gen_random_uuid(), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'ffffffff-ffff-4fff-8fff-ffffffffffff'), -- In Progress -> Done (direct)
  (gen_random_uuid(), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), -- In Progress -> To Do (back)
  (gen_random_uuid(), '33333303-0003-4003-8003-000000000003', 'ffffffff-ffff-4fff-8fff-ffffffffffff'), -- Review -> Done
  (gen_random_uuid(), '33333303-0003-4003-8003-000000000003', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'); -- Review -> In Progress (back)

-- =====================================================
-- 5. LABELS
-- =====================================================
INSERT INTO labels (lab_labelid, lab_name, lab_color, lab_created_at)
VALUES
  ('00000001-0001-4001-8001-000000000001', 'bug', '#ff0000', NOW()),
  ('00000002-0002-4002-8002-000000000002', 'feature', '#00ff00', NOW()),
  ('00000003-0003-4003-8003-000000000003', 'enhancement', '#0000ff', NOW()),
  ('00000004-0004-4004-8004-000000000004', 'urgent', '#ff6600', NOW()),
  ('00000005-0005-4005-8005-000000000005', 'documentation', '#9900ff', NOW());

-- =====================================================
-- 6. REFERENCE TYPES
-- =====================================================
INSERT INTO referencetypes (rt_rtid, rt_name)
VALUES
  (1, 'task'),
  (2, 'chat_message')
ON CONFLICT (rt_rtid) DO NOTHING;

-- =====================================================
-- 7. CHAT CONTAINERS
-- =====================================================
INSERT INTO chatcontainers (chat_chatid, chat_name, chat_created_by, chat_created_at)
VALUES
  ('90000001-0001-4001-8001-000000000001', 'General', '11111111-1111-1111-1111-111111111111', NOW());

-- =====================================================
-- NOTE: Tasks, Comments, and Chat Messages not included here
-- as they should be customized per project with proper user IDs
-- Use the generate-tasks.sql script for each project separately
-- =====================================================
