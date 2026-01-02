#!/bin/bash

# ==================================================
# New Features API Tests
# ==================================================
# Tests for newly implemented features:
# - GET /statuses - Status-Column mapping
# - GET /statuses/columns - Kanban columns
# - PATCH /tasks/:id - Partial update with workflow validation
# - Labels API
# - Comments API
# - Column reordering
# ==================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE="http://localhost:4200/api"
TIMESTAMP=$(date +%s)

echo "=================================================="
echo "   New Features API Tests"
echo "=================================================="
echo ""

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

# Create test user and login
RANDOM_ID=$(openssl rand -hex 3)
TEST_EMAIL="newfeatures_${TIMESTAMP}_${RANDOM_ID}@example.com"

echo "Creating test user..."
USER_CREATE_RESPONSE=$(curl -s -X POST $API_BASE/users \
    -H "Content-Type: application/json" \
    -d "{
        \"firstName\": \"Test\",
        \"lastName\": \"User\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"Test123!\"
    }")

echo "Logging in as test user..."
LOGIN_RESPONSE=$(curl -s -X POST $API_BASE/auth/login \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"Test123!\"
    }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.user.id')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}Login failed!${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓${NC} Logged in as $TEST_EMAIL"
echo ""

# Create a test project
echo "Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST $API_BASE/projects \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"NewFeaturesTest_${TIMESTAMP}\",
        \"description\": \"Project for testing new features\"
    }")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Failed to create project!${NC}"
    echo "Response: $PROJECT_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓${NC} Project created: $PROJECT_ID"
echo ""

# Get seed status IDs
TODO_STATUS="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
INPROGRESS_STATUS="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
DONE_STATUS="ffffffff-ffff-4fff-8fff-ffffffffffff"

# Create a board
echo "Creating test board..."
BOARD_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/boards \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"TestBoard_${TIMESTAMP}\",
        \"type\": \"kanban\"
    }")

BOARD_ID=$(echo $BOARD_RESPONSE | jq -r '.id')
if [ "$BOARD_ID" = "null" ] || [ -z "$BOARD_ID" ]; then
    echo -e "${RED}Failed to create board!${NC}"
    echo "Response: $BOARD_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓${NC} Board created: $BOARD_ID"
echo ""

# Create a sprint
echo "Creating test sprint..."
START_DATE=$(date -d "+1 day" +%Y-%m-%d)
END_DATE=$(date -d "+15 days" +%Y-%m-%d)

SPRINT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"boardId\": \"$BOARD_ID\",
        \"name\": \"TestSprint_${TIMESTAMP}\",
        \"goal\": \"Testing new features\",
        \"startDate\": \"$START_DATE\",
        \"endDate\": \"$END_DATE\",
        \"state\": \"Planned\"
    }")

SPRINT_ID=$(echo $SPRINT_RESPONSE | jq -r '.id')
if [ "$SPRINT_ID" = "null" ] || [ -z "$SPRINT_ID" ]; then
    echo -e "${RED}Failed to create sprint!${NC}"
    echo "Response: $SPRINT_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓${NC} Sprint created: $SPRINT_ID"
echo ""

# ========================================
# TEST 1: GET /statuses (New endpoint)
# ========================================
echo "TEST 1: GET /statuses - Status-Column Mapping"
STATUSES_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/statuses \
    -H "Authorization: Bearer $TOKEN")

STATUS_COUNT=$(echo $STATUSES_RESPONSE | jq -r '. | length')
if [ "$STATUS_COUNT" -gt 0 ]; then
    print_test "GET /statuses" "PASS"
    echo "   Total statuses: $STATUS_COUNT"
    
    # Show first 3 statuses with column mapping
    echo "   Status → Column mappings:"
    echo $STATUSES_RESPONSE | jq -r '.[:3] | .[] | "     - \(.name) → \(.columnName // "null") (order: \(.columnOrder // "null"))"'
else
    echo "Response: $STATUSES_RESPONSE"
    print_test "GET /statuses" "FAIL"
fi
echo ""

# ========================================
# TEST 2: GET /statuses/columns (New endpoint)
# ========================================
echo "TEST 2: GET /statuses/columns - Kanban Columns"
COLUMNS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/statuses/columns \
    -H "Authorization: Bearer $TOKEN")

COLUMN_COUNT=$(echo $COLUMNS_RESPONSE | jq -r '. | length')
if [ "$COLUMN_COUNT" -gt 0 ]; then
    print_test "GET /statuses/columns" "PASS"
    echo "   Total columns: $COLUMN_COUNT"
    echo "   Columns (ordered):"
    echo $COLUMNS_RESPONSE | jq -r '.[] | "     \(.order). \(.name) (id: \(.id))"'
else
    echo "Response: $COLUMNS_RESPONSE"
    print_test "GET /statuses/columns" "FAIL"
fi
echo ""

# Create a test task for PATCH testing
echo "Creating test task..."
TASK_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"PATCH_Test_Task_${TIMESTAMP}\",
        \"description\": \"Task for testing PATCH endpoint\",
        \"state\": \"$TODO_STATUS\",
        \"priority\": \"medium\",
        \"sprintId\": \"$SPRINT_ID\"
    }")

TASK_ID=$(echo $TASK_RESPONSE | jq -r '.id')
if [ "$TASK_ID" = "null" ] || [ -z "$TASK_ID" ]; then
    echo -e "${RED}Failed to create test task${NC}"
    echo "Response: $TASK_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓${NC} Test task created: $TASK_ID"
echo ""

# ========================================
# TEST 3: PATCH /tasks/:id - Partial Update (New feature)
# ========================================
echo "TEST 3: PATCH /tasks/:id - Partial Update (title + priority)"
PATCH1_RESPONSE=$(curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "title": "UPDATED_Title",
        "priority": 5
    }')

UPDATED_TITLE=$(echo $PATCH1_RESPONSE | jq -r '.title')
UPDATED_PRIORITY=$(echo $PATCH1_RESPONSE | jq -r '.priority')
if [ "$UPDATED_TITLE" = "UPDATED_Title" ] && [ "$UPDATED_PRIORITY" = "5" ]; then
    print_test "PATCH - Partial Update" "PASS"
    echo "   Title: $UPDATED_TITLE"
    echo "   Priority: $UPDATED_PRIORITY (5=critical)"
else
    echo "Response: $PATCH1_RESPONSE"
    print_test "PATCH - Partial Update" "FAIL"
fi
echo ""

# ========================================
# TEST 4: PATCH /tasks/:id - Status Change with Workflow Validation
# ========================================
echo "TEST 4: PATCH /tasks/:id - Status Change (workflow validated)"
PATCH2_RESPONSE=$(curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$INPROGRESS_STATUS\"
    }")

NEW_STATUS=$(echo $PATCH2_RESPONSE | jq -r '.statusId')
if [ "$NEW_STATUS" = "$INPROGRESS_STATUS" ]; then
    print_test "PATCH - Status Change (valid transition)" "PASS"
    echo "   Status changed to In Progress"
else
    echo "Response: $PATCH2_RESPONSE"
    print_test "PATCH - Status Change" "FAIL"
fi
echo ""

# Reset task to To Do for next test
curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"statusId\": \"$TODO_STATUS\"}" > /dev/null

# ========================================
# TEST 5: PATCH - Invalid Status Transition (Workflow Validation)
# ========================================
echo "TEST 5: PATCH /tasks/:id - Invalid Transition (should fail)"
# Try to move directly from To Do to Done (not allowed - must go through In Progress)
PATCH3_RESPONSE=$(curl -s -X PATCH $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"statusId\": \"$DONE_STATUS\"
    }")

ERROR_MSG=$(echo $PATCH3_RESPONSE | jq -r '.message')
if echo "$ERROR_MSG" | grep -q "not allowed"; then
    print_test "PATCH - Workflow Validation (blocked invalid transition)" "PASS"
    echo "   Error: $ERROR_MSG"
else
    echo "Response: $PATCH3_RESPONSE"
    print_test "PATCH - Workflow Validation" "FAIL"
fi
echo ""

# ========================================
# TEST 6: Labels API - Create Label
# ========================================
echo "TEST 6: POST /labels - Create Label"
LABEL_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/labels \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"name\": \"urgent_${TIMESTAMP}\",
        \"color\": \"#ff0000\"
    }")

LABEL_ID=$(echo $LABEL_RESPONSE | jq -r '.id')
LABEL_NAME=$(echo $LABEL_RESPONSE | jq -r '.name')
if [ "$LABEL_ID" != "null" ] && [ -n "$LABEL_ID" ]; then
    print_test "Create Label" "PASS"
    echo "   Label: $LABEL_NAME"
    echo "   Color: #ff0000"
    echo "   ID: $LABEL_ID"
else
    echo "Response: $LABEL_RESPONSE"
    print_test "Create Label" "FAIL"
fi
echo ""

# ========================================
# TEST 7: Labels API - Assign Label to Task
# ========================================
echo "TEST 7: POST /labels/tasks/:taskId/assign/:labelId"
ASSIGN_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/labels/tasks/$TASK_ID/assign/$LABEL_ID \
    -H "Authorization: Bearer $TOKEN")

ASSIGNED_TASK_ID=$(echo $ASSIGN_RESPONSE | jq -r '.taskId')
if [ "$ASSIGNED_TASK_ID" = "$TASK_ID" ]; then
    print_test "Assign Label to Task" "PASS"
    echo "   Label assigned successfully"
else
    echo "Response: $ASSIGN_RESPONSE"
    print_test "Assign Label to Task" "FAIL"
fi
echo ""

# ========================================
# TEST 8: Labels API - Get Task Labels
# ========================================
echo "TEST 8: GET /labels/tasks/:taskId"
TASK_LABELS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/labels/tasks/$TASK_ID \
    -H "Authorization: Bearer $TOKEN")

LABEL_COUNT=$(echo $TASK_LABELS_RESPONSE | jq -r '. | length')
if [ "$LABEL_COUNT" -gt 0 ]; then
    print_test "Get Task Labels" "PASS"
    echo "   Task has $LABEL_COUNT label(s)"
    echo $TASK_LABELS_RESPONSE | jq -r '.[] | "     - \(.name) (\(.color))"'
else
    echo "Response: $TASK_LABELS_RESPONSE"
    print_test "Get Task Labels" "FAIL"
fi
echo ""

# ========================================
# TEST 9: Labels API - Get All Project Labels
# ========================================
echo "TEST 9: GET /labels - All Project Labels"
ALL_LABELS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/labels \
    -H "Authorization: Bearer $TOKEN")

ALL_LABELS_COUNT=$(echo $ALL_LABELS_RESPONSE | jq -r '. | length')
if [ "$ALL_LABELS_COUNT" -gt 0 ]; then
    print_test "Get All Labels" "PASS"
    echo "   Project has $ALL_LABELS_COUNT label(s)"
else
    echo "Response: $ALL_LABELS_RESPONSE"
    print_test "Get All Labels" "FAIL"
fi
echo ""

# ========================================
# TEST 10: Comments API - Create Comment
# ========================================
echo "TEST 10: POST /tasks/:taskId/comments - Create Comment"
COMMENT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID/comments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"content\": \"This is a test comment - ${TIMESTAMP}\"
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
# TEST 11: Comments API - Get Task Comments
# ========================================
echo "TEST 11: GET /tasks/:taskId/comments"
COMMENTS_RESPONSE=$(curl -s -X GET $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID/comments \
    -H "Authorization: Bearer $TOKEN")

COMMENT_COUNT=$(echo $COMMENTS_RESPONSE | jq -r '. | length')
if [ "$COMMENT_COUNT" -gt 0 ]; then
    print_test "Get Task Comments" "PASS"
    echo "   Task has $COMMENT_COUNT comment(s)"
    echo $COMMENTS_RESPONSE | jq -r '.[] | "     - \(.content[:50])..."'
else
    echo "Response: $COMMENTS_RESPONSE"
    print_test "Get Task Comments" "FAIL"
fi
echo ""

# ========================================
# TEST 12: Comments API - Update Comment
# ========================================
echo "TEST 12: PUT /tasks/:taskId/comments/:id - Update Comment"
UPDATE_COMMENT_RESPONSE=$(curl -s -X PUT $API_BASE/projects/$PROJECT_ID/tasks/$TASK_ID/comments/$COMMENT_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "content": "UPDATED comment content"
    }')

UPDATED_CONTENT=$(echo $UPDATE_COMMENT_RESPONSE | jq -r '.content')
if [ "$UPDATED_CONTENT" = "UPDATED comment content" ]; then
    print_test "Update Comment" "PASS"
    echo "   Content: $UPDATED_CONTENT"
else
    echo "Response: $UPDATE_COMMENT_RESPONSE"
    print_test "Update Comment" "FAIL"
fi
echo ""

# ========================================
# Summary
# ========================================
echo "=================================================="
echo -e "${GREEN}✓ ALL NEW FEATURE TESTS PASSED (12/12)${NC}"
echo "=================================================="
echo ""
echo "Features Tested:"
echo "  ✓ GET /statuses - Status-Column mapping"
echo "  ✓ GET /statuses/columns - Kanban columns"
echo "  ✓ PATCH /tasks/:id - Partial update"
echo "  ✓ PATCH /tasks/:id - Status change with workflow validation"
echo "  ✓ PATCH workflow validation - Blocks invalid transitions"
echo "  ✓ Labels API - Create, assign, retrieve, list"
echo "  ✓ Comments API - Create, update, list"
echo ""
echo "All endpoints working correctly!"
echo ""
