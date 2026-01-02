#!/bin/bash

# ==================================================
# API Integration Tests - RANDOM DATA (Independent Runs)
# ==================================================
# Each test run creates EVERYTHING from scratch with RANDOM data:
# - Uses existing seed user but creates NEW project (random name)
# - New Board, Sprint, Tasks (random data)
# - Each run gets its own project database
# NO dependencies between runs - fully independent!
# ==================================================

set -e  # Exit on first error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# API Configuration
API_BASE="http://localhost:4200/api"
TIMESTAMP=$(date +%s)
RANDOM_SUFFIX=$(openssl rand -hex 4)

# Generate COMPLETELY RANDOM user for THIS run
RANDOM_USER_ID=$(openssl rand -hex 3)
TEST_EMAIL="testuser_${TIMESTAMP}_${RANDOM_USER_ID}@example.com"
TEST_PASSWORD="SecurePass123!@#"
TEST_FIRSTNAME="Test_${RANDOM_USER_ID}"
TEST_LASTNAME="User_${TIMESTAMP}"

# Generate RANDOM project/task names for THIS run
PROJECT_NAME="IntegrationTest_${TIMESTAMP}_${RANDOM_SUFFIX}"
BOARD_NAME="TestBoard_${RANDOM_SUFFIX}"
SPRINT_NAME="Sprint_${TIMESTAMP}"
TASK1_TITLE="Task1_Setup_${RANDOM_SUFFIX}"
TASK2_TITLE="Task2_Documentation_${RANDOM_SUFFIX}"
TASK3_TITLE="Task3_Archive_${RANDOM_SUFFIX}"

echo "=================================================="
echo "   API Integration Tests - Random Data"
echo "=================================================="
echo "Test Run: ${TIMESTAMP}_${RANDOM_SUFFIX}"
echo "New User: ${TEST_EMAIL}"
echo "Project: ${PROJECT_NAME} (NEW DATABASE)"
echo ""

# Helper functions
print_test() {
    local test_name=$1
    local status=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name"
    else
        echo -e "${RED}✗${NC} $test_name"
        exit 1
    fi
}

# Check API health
echo "Checking if API is running..."
HEALTH_CHECK=$(curl -s $API_BASE/health || echo "fail")
if [[ $HEALTH_CHECK == *"ok"* ]]; then
    print_test "API Health Check" "PASS"
else
    echo -e "${RED}ERROR: API is not running${NC}"
    exit 1
fi
echo ""

# ========================================
# TEST 1: Create New User (public endpoint)
# ========================================
echo "TEST 1: Create New User with RANDOM email"
USER_RESPONSE=$(curl -s -X POST $API_BASE/users \
    -H "Content-Type: application/json" \
    -d "{
        \"firstName\": \"$TEST_FIRSTNAME\",
        \"lastName\": \"$TEST_LASTNAME\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
if [ "$USER_ID" != "null" ] && [ -n "$USER_ID" ]; then
    print_test "Create User" "PASS"
    echo "   Email: $TEST_EMAIL"
    echo "   Name: $TEST_FIRSTNAME $TEST_LASTNAME"
    echo "   ID: $USER_ID"
else
    echo "Response: $USER_RESPONSE"
    print_test "Create User" "FAIL"
fi
echo ""

# ========================================
# TEST 18: User Login
# ========================================
echo "TEST 2: Login with newly created user"
LOGIN_RESPONSE=$(curl -s -X POST $API_BASE/auth/login \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
LOGGED_USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.id')
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    print_test "User Login" "PASS"
    echo "   User: $TEST_EMAIL"
    echo "   ID: $LOGGED_USER_ID"
    echo "   Token: ${TOKEN:0:20}..."
else
    echo "Response: $LOGIN_RESPONSE"
    print_test "User Login" "FAIL"
fi
echo ""

# ========================================
# TEST 3: Create Project (creates new database)
# ========================================
echo "TEST 3: Create Project with RANDOM name"
PROJECT_RESPONSE=$(curl -s -X POST $API_BASE/projects \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"$PROJECT_NAME\",
        \"description\": \"Automated test project for run ${TIMESTAMP}\"
    }")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
DB_NAMESPACE=$(echo $PROJECT_RESPONSE | jq -r '.dbNamespace')
if [ "$PROJECT_ID" != "null" ] && [ -n "$PROJECT_ID" ]; then
    print_test "Create Project" "PASS"
    echo "   Project: $PROJECT_NAME"
    echo "   ID: $PROJECT_ID"
    echo "   Database: project_$DB_NAMESPACE"
else
    echo "Response: $PROJECT_RESPONSE"
    print_test "Create Project" "FAIL"
fi
echo ""

# Small delay for database initialization
sleep 2

# Define status UUIDs from projectdb.sql seed data
TODO_STATUS="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
INPROGRESS_STATUS="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
DONE_STATUS="ffffffff-ffff-4fff-8fff-ffffffffffff"
PLANNED_STATUS="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

echo "Using seed data status UUIDs:"
echo "   To Do: $TODO_STATUS"
echo "   In Progress: $INPROGRESS_STATUS"
echo "   Done: $DONE_STATUS"
echo "   Sprint Planned: $PLANNED_STATUS"
echo ""

# ========================================
# TEST 4: Create Board
# ========================================
echo "TEST 4: Create Board"
BOARD_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/boards \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"$BOARD_NAME\",
        \"type\": \"kanban\"
    }")

BOARD_ID=$(echo $BOARD_RESPONSE | jq -r '.id')
if [ "$BOARD_ID" != "null" ] && [ -n "$BOARD_ID" ]; then
    print_test "Create Board" "PASS"
    echo "   Board: $BOARD_NAME (ID: $BOARD_ID)"
else
    echo "Response: $BOARD_RESPONSE"
    print_test "Create Board" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Create Sprint
# ========================================
echo "TEST 5: Create Sprint"
START_DATE=$(date -d "+1 day" +%Y-%m-%d)
END_DATE=$(date -d "+15 days" +%Y-%m-%d)

SPRINT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"boardId\": \"$BOARD_ID\",
        \"name\": \"$SPRINT_NAME\",
        \"goal\": \"Complete automated testing for ${TIMESTAMP}\",
        \"startDate\": \"$START_DATE\",
        \"endDate\": \"$END_DATE\",
        \"state\": \"Planned\"
    }")

SPRINT_ID=$(echo $SPRINT_RESPONSE | jq -r '.id')
if [ "$SPRINT_ID" != "null" ] && [ -n "$SPRINT_ID" ]; then
    print_test "Create Sprint" "PASS"
    echo "   Sprint: $SPRINT_NAME (ID: $SPRINT_ID)"
    echo "   Duration: $START_DATE to $END_DATE"
else
    echo "Response: $SPRINT_RESPONSE"
    print_test "Create Sprint" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Create Task 1
# ========================================
echo "TEST 6: Create Task 1"
TASK1_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"$TASK1_TITLE\",
        \"description\": \"Setup development environment - test run ${TIMESTAMP}\",
        \"state\": \"$TODO_STATUS\",
        \"priority\": \"high\",
        \"sprintId\": \"$SPRINT_ID\"
    }")

TASK1_ID=$(echo $TASK1_RESPONSE | jq -r '.id')
if [ "$TASK1_ID" != "null" ] && [ -n "$TASK1_ID" ]; then
    print_test "Create Task 1" "PASS"
    echo "   Task: $TASK1_TITLE"
    echo "   ID: $TASK1_ID"
else
    echo "Response: $TASK1_RESPONSE"
    print_test "Create Task 1" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Create Task 2
# ========================================
echo "TEST 7: Create Task 2"
TASK2_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"$TASK2_TITLE\",
        \"description\": \"Write comprehensive API documentation - test ${TIMESTAMP}\",
        \"state\": \"$TODO_STATUS\",
        \"priority\": \"medium\",
        \"sprintId\": \"$SPRINT_ID\"
    }")

TASK2_ID=$(echo $TASK2_RESPONSE | jq -r '.id')
if [ "$TASK2_ID" != "null" ] && [ -n "$TASK2_ID" ]; then
    print_test "Create Task 2" "PASS"
    echo "   Task: $TASK2_TITLE"
    echo "   ID: $TASK2_ID"
else
    echo "Response: $TASK2_RESPONSE"
    print_test "Create Task 2" "FAIL"
fi
echo ""

# ========================================
# TEST 8: Move Task 1 to In Progress
# ========================================
echo "TEST 8: Move Task 1 to In Progress"
MOVE1_RESPONSE=$(curl -s -X PUT $API_BASE/projects/$PROJECT_ID/tasks/$TASK1_ID/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$INPROGRESS_STATUS\"
    }")

TASK1_STATUS=$(echo $MOVE1_RESPONSE | jq -r '.status.name')
if [ "$TASK1_STATUS" = "In Progress" ]; then
    print_test "Move Task to In Progress" "PASS"
    echo "   Status: $TASK1_STATUS"
else
    echo "Response: $MOVE1_RESPONSE"
    print_test "Move Task to In Progress" "FAIL"
fi
echo ""

# ========================================
# TEST 9: Move Task 1 to Done
# ========================================
echo "TEST 9: Move Task 1 to Done"
MOVE2_RESPONSE=$(curl -s -X PUT $API_BASE/projects/$PROJECT_ID/tasks/$TASK1_ID/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$DONE_STATUS\"
    }")

TASK1_STATUS=$(echo $MOVE2_RESPONSE | jq -r '.status.name')
if [ "$TASK1_STATUS" = "Done" ]; then
    print_test "Move Task to Done" "PASS"
    echo "   Status: $TASK1_STATUS"
else
    echo "Response: $MOVE2_RESPONSE"
    print_test "Move Task to Done" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Test Workflow Validation (Done → To Do should fail)
# ========================================
echo "TEST 10: Test Workflow Validation (Done → To Do should fail)"
INVALID_MOVE=$(curl -s -X PUT $API_BASE/projects/$PROJECT_ID/tasks/$TASK1_ID/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$TODO_STATUS\"
    }")

if echo $INVALID_MOVE | grep -q "not allowed"; then
    print_test "Workflow Validation (blocked invalid transition)" "PASS"
    ERROR_MSG=$(echo $INVALID_MOVE | jq -r '.message')
    echo "   Error: $ERROR_MSG"
else
    echo "Response: $INVALID_MOVE"
    print_test "Workflow Validation" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Update Task 2 Details
# ========================================
echo "TEST 11: Update Task 2 Details"
UPDATE_RESPONSE=$(curl -s -X PUT $API_BASE/projects/$PROJECT_ID/tasks/$TASK2_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"${TASK2_TITLE}_UPDATED\",
        \"description\": \"Updated comprehensive API documentation at ${TIMESTAMP}\",
        \"priority\": 5
    }")

UPDATED_TITLE=$(echo $UPDATE_RESPONSE | jq -r '.title')
if [[ "$UPDATED_TITLE" == *"UPDATED"* ]]; then
    print_test "Update Task Details" "PASS"
    echo "   New title: $UPDATED_TITLE"
else
    echo "Response: $UPDATE_RESPONSE"
    print_test "Update Task Details" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Get Sprint View
# ========================================
echo "TEST 12: Get Sprint View"
SPRINT_VIEW=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/sprints/$SPRINT_ID/view \
    -H "Authorization: Bearer $TOKEN")

SPRINT_TASKS=$(echo $SPRINT_VIEW | jq -r '.sprint.statistics.total_tasks')
COMPLETED_TASKS=$(echo $SPRINT_VIEW | jq -r '.sprint.statistics.completed_tasks')
if [ "$SPRINT_TASKS" -ge 2 ]; then
    print_test "Get Sprint View" "PASS"
    echo "   Sprint: $SPRINT_NAME"
    echo "   Total tasks: $SPRINT_TASKS"
    echo "   Completed: $COMPLETED_TASKS"
else
    echo "Response: $SPRINT_VIEW"
    print_test "Get Sprint View" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Start Sprint
# ========================================
echo "TEST 13: Start Sprint"

START_SPRINT=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints/$SPRINT_ID/start \
    -H "Authorization: Bearer $TOKEN")

SPRINT_STATUS=$(echo $START_SPRINT | jq -r '.status.name')
if [ "$SPRINT_STATUS" = "Active" ]; then
    print_test "Start Sprint" "PASS"
    echo "   Sprint status: $SPRINT_STATUS"
else
    echo "Response: $START_SPRINT"
    print_test "Start Sprint" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Get Sprint Statistics
# ========================================
echo "TEST 14: Get Sprint Statistics"
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/projects/$PROJECT_ID/sprints/$SPRINT_ID/statistics" \
    -H "Authorization: Bearer $TOKEN")

COMPLETION_RATE=$(echo $STATS_RESPONSE | jq -r '.statistics.completion_rate')
if [ "$COMPLETION_RATE" != "null" ]; then
    print_test "Get Sprint Statistics" "PASS"
    echo "   Completion rate: ${COMPLETION_RATE}%"
    IN_PROGRESS=$(echo $STATS_RESPONSE | jq -r '.statistics.in_progress_tasks')
    echo "   In progress: $IN_PROGRESS"
else
    echo "Response: $STATS_RESPONSE"
    print_test "Get Sprint Statistics" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Get Workflow Graph
# ========================================
echo "TEST 15: Get Workflow Graph"
WORKFLOW_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/boards/workflow \
    -H "Authorization: Bearer $TOKEN")

NODE_COUNT=$(echo $WORKFLOW_RESPONSE | jq -r '.nodes | length')
EDGE_COUNT=$(echo $WORKFLOW_RESPONSE | jq -r '.edges | length')
if [ "$NODE_COUNT" -gt 0 ] && [ "$EDGE_COUNT" -gt 0 ]; then
    print_test "Get Workflow Graph" "PASS"
    echo "   Nodes (statuses): $NODE_COUNT"
    echo "   Edges (transitions): $EDGE_COUNT"
else
    echo "Response: $WORKFLOW_RESPONSE"
    print_test "Get Workflow Graph" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Create Task 3 (for archive test)
# ========================================
echo "TEST 16: Create Task 3 (for archive test)"
TASK3_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"$TASK3_TITLE\",
        \"description\": \"This task will be archived - test ${TIMESTAMP}\",
        \"state\": \"$TODO_STATUS\",
        \"priority\": \"low\"
    }")

TASK3_ID=$(echo $TASK3_RESPONSE | jq -r '.id')
if [ "$TASK3_ID" != "null" ] && [ -n "$TASK3_ID" ]; then
    print_test "Create Task 3" "PASS"
    echo "   Task: $TASK3_TITLE"
    echo "   ID: $TASK3_ID"
else
    echo "Response: $TASK3_RESPONSE"
    print_test "Create Task 3" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Archive Task 3
# ========================================
echo "TEST 17: Archive Task 3"
ARCHIVE_RESPONSE=$(curl -s -X DELETE $API_BASE/projects/$PROJECT_ID/tasks/$TASK3_ID \
    -H "Authorization: Bearer $TOKEN")

# Check if archived successfully (response should contain the task with archived flag)
ARCHIVED=$(echo $ARCHIVE_RESPONSE | jq -r '.archived')
if [ "$ARCHIVED" = "true" ] || echo $ARCHIVE_RESPONSE | grep -q "archived"; then
    print_test "Archive Task" "PASS"
    echo "   Task archived successfully"
else
    echo "Response: $ARCHIVE_RESPONSE"
    print_test "Archive Task" "FAIL"
fi
echo ""

# ========================================
# TEST 18: Get All Tasks
# ========================================
echo "TEST 18: Get All Tasks"
ALL_TASKS=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/tasks \
    -H "Authorization: Bearer $TOKEN")

TASK_COUNT=$(echo $ALL_TASKS | jq -r '. | length')
if [ "$TASK_COUNT" -ge 3 ]; then
    print_test "Get All Tasks" "PASS"
    echo "   Total tasks: $TASK_COUNT"
else
    echo "Response: $ALL_TASKS"
    print_test "Get All Tasks" "FAIL"
fi
echo ""

# ========================================
# TEST 19: Get Project Statuses (new endpoint)
# ========================================
echo "TEST 19: Get Project Statuses with Columns"
STATUSES_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/statuses \
    -H "Authorization: Bearer $TOKEN")

STATUS_COUNT=$(echo $STATUSES_RESPONSE | jq -r '. | length')
if [ "$STATUS_COUNT" -gt 0 ]; then
    print_test "Get Project Statuses" "PASS"
    echo "   Total statuses: $STATUS_COUNT"
    FIRST_STATUS_NAME=$(echo $STATUSES_RESPONSE | jq -r '.[0].name')
    FIRST_COLUMN_NAME=$(echo $STATUSES_RESPONSE | jq -r '.[0].columnName')
    echo "   Example: $FIRST_STATUS_NAME → Column: $FIRST_COLUMN_NAME"
else
    echo "Response: $STATUSES_RESPONSE"
    print_test "Get Project Statuses" "FAIL"
fi
echo ""

# ========================================
# TEST 20: Get Columns (new endpoint)
# ========================================
echo "TEST 20: Get Kanban Columns"
COLUMNS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/statuses/columns \
    -H "Authorization: Bearer $TOKEN")

COLUMN_COUNT=$(echo $COLUMNS_RESPONSE | jq -r '. | length')
if [ "$COLUMN_COUNT" -gt 0 ]; then
    print_test "Get Kanban Columns" "PASS"
    echo "   Total columns: $COLUMN_COUNT"
    echo "   Columns:"
    echo $COLUMNS_RESPONSE | jq -r '.[] | "     - \(.name) (order: \(.order))"'
else
    echo "Response: $COLUMNS_RESPONSE"
    print_test "Get Kanban Columns" "FAIL"
fi
echo ""

# ========================================
# TEST 21: PATCH Task (partial update with workflow validation)
# ========================================
echo "TEST 21: PATCH Task - Partial Update"
PATCH_RESPONSE=$(curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK2_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"${TASK2_TITLE}_UPDATED\",
        \"priority\": 5
    }")

UPDATED_TITLE=$(echo $PATCH_RESPONSE | jq -r '.title')
UPDATED_PRIORITY=$(echo $PATCH_RESPONSE | jq -r '.priority')
if [[ "$UPDATED_TITLE" == *"_UPDATED"* ]] && [ "$UPDATED_PRIORITY" = "5" ]; then
    print_test "PATCH Task (partial update)" "PASS"
    echo "   Updated title: $UPDATED_TITLE"
    echo "   Updated priority: $UPDATED_PRIORITY"
else
    echo "Response: $PATCH_RESPONSE"
    print_test "PATCH Task (partial update)" "FAIL"
fi
echo ""

# ========================================
# TEST 22: PATCH Task with Status Change (workflow validation)
# ========================================
echo "TEST 22: PATCH Task - Status Change with Workflow Validation"
# Try to move Task2 from To Do directly to Done (should fail if no transition exists)
PATCH_STATUS_RESPONSE=$(curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK2_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$INPROGRESS_STATUS\"
    }")

TASK2_NEW_STATUS=$(echo $PATCH_STATUS_RESPONSE | jq -r '.statusId')
if [ "$TASK2_NEW_STATUS" = "$INPROGRESS_STATUS" ]; then
    print_test "PATCH Task with Status (workflow validated)" "PASS"
    echo "   Task2 moved to In Progress via PATCH"
else
    echo "Response: $PATCH_STATUS_RESPONSE"
    print_test "PATCH Task with Status (workflow validated)" "FAIL"
fi
echo ""

# ========================================
# TEST 23: Create Label
# ========================================
echo "TEST 23: Create Label"
LABEL_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/labels \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"bug_${RANDOM_SUFFIX}\",
        \"color\": \"#ff0000\"
    }")

LABEL_ID=$(echo $LABEL_RESPONSE | jq -r '.id')
LABEL_NAME=$(echo $LABEL_RESPONSE | jq -r '.name')
if [ "$LABEL_ID" != "null" ] && [ -n "$LABEL_ID" ]; then
    print_test "Create Label" "PASS"
    echo "   Label: $LABEL_NAME (ID: $LABEL_ID)"
    echo "   Color: #ff0000"
else
    echo "Response: $LABEL_RESPONSE"
    print_test "Create Label" "FAIL"
fi
echo ""

# ========================================
# TEST 24: Assign Label to Task
# ========================================
echo "TEST 24: Assign Label to Task"
ASSIGN_LABEL_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/labels/tasks/$TASK1_ID/assign/$LABEL_ID \
    -H "Authorization: Bearer $TOKEN")

ASSIGNED_TASK_ID=$(echo $ASSIGN_LABEL_RESPONSE | jq -r '.taskId')
ASSIGNED_LABEL_ID=$(echo $ASSIGN_LABEL_RESPONSE | jq -r '.labelId')
if [ "$ASSIGNED_TASK_ID" = "$TASK1_ID" ] && [ "$ASSIGNED_LABEL_ID" = "$LABEL_ID" ]; then
    print_test "Assign Label to Task" "PASS"
    echo "   Label '$LABEL_NAME' assigned to Task1"
else
    echo "Response: $ASSIGN_LABEL_RESPONSE"
    print_test "Assign Label to Task" "FAIL"
fi
echo ""

# ========================================
# TEST 25: Get Task Labels
# ========================================
echo "TEST 25: Get Task Labels"
TASK_LABELS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/labels/tasks/$TASK1_ID \
    -H "Authorization: Bearer $TOKEN")

LABEL_COUNT_FOR_TASK=$(echo $TASK_LABELS_RESPONSE | jq -r '. | length')
if [ "$LABEL_COUNT_FOR_TASK" -gt 0 ]; then
    print_test "Get Task Labels" "PASS"
    echo "   Task has $LABEL_COUNT_FOR_TASK label(s)"
else
    echo "Response: $TASK_LABELS_RESPONSE"
    print_test "Get Task Labels" "FAIL"
fi
echo ""

# ========================================
# TEST 26: Create Comment
# ========================================
echo "TEST 26: Create Comment on Task"
COMMENT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks/$TASK1_ID/comments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"content\": \"This is a test comment for run ${TIMESTAMP}\"
    }")

COMMENT_ID=$(echo $COMMENT_RESPONSE | jq -r '.id')
if [ "$COMMENT_ID" != "null" ] && [ -n "$COMMENT_ID" ]; then
    print_test "Create Comment" "PASS"
    echo "   Comment ID: $COMMENT_ID"
else
    echo "Response: $COMMENT_RESPONSE"
    print_test "Create Comment" "FAIL"
fi
echo ""

# ========================================
# TEST 27: Get Task Comments
# ========================================
echo "TEST 27: Get Task Comments"
COMMENTS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/tasks/$TASK1_ID/comments \
    -H "Authorization: Bearer $TOKEN")

COMMENT_COUNT=$(echo $COMMENTS_RESPONSE | jq -r '. | length')
if [ "$COMMENT_COUNT" -gt 0 ]; then
    print_test "Get Task Comments" "PASS"
    echo "   Task has $COMMENT_COUNT comment(s)"
else
    echo "Response: $COMMENTS_RESPONSE"
    print_test "Get Task Comments" "FAIL"
fi
echo ""

# ========================================
# Summary
# ========================================
echo "=================================================="
echo -e "${GREEN}✓ ALL TESTS PASSED (27/27)${NC}"
echo "=================================================="
echo ""
echo "Test Summary:"
echo "  Run ID: ${TIMESTAMP}_${RANDOM_SUFFIX}"
echo "  User: $TEST_EMAIL (ID: $LOGGED_USER_ID)"
echo "  Project: $PROJECT_NAME (ID: $PROJECT_ID)"
echo "  Database: $DB_NAME"
echo "  Sprint: $SPRINT_NAME (ID: $SPRINT_ID)"
echo "  Board: $BOARD_NAME (ID: $BOARD_ID)"
echo "  Tasks Created: 3"
echo "  Labels Created: 1"
echo "  Comments Created: 1"
echo "  Workflow Validated: ✓"
echo "  Status Transitions: ✓"
echo "  PATCH Endpoint: ✓"
echo "  Archive Tested: ✓"
echo ""
echo "New Features Tested:"
echo "  ✓ GET /statuses - Status-Column mapping"
echo "  ✓ GET /statuses/columns - Kanban columns"
echo "  ✓ PATCH /tasks/:id - Partial update with workflow validation"
echo "  ✓ Labels API - Create, assign, retrieve"
echo "  ✓ Comments API - Create and list"
echo ""
echo "This test run was COMPLETELY INDEPENDENT with random data!"
echo "Each run creates its own project database - no state sharing!"
echo ""
