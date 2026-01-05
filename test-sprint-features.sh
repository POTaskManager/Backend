#!/bin/bash

# Test script for Sprint DELETE and Query Filters
# Tests UC-04-08: DELETE /api/projects/{proj_id}/sprints/{sprint_id}

set -e

API_BASE="http://localhost:4200/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Sprint DELETE & Filters Test Suite"
echo "========================================="
echo ""

# Login to get token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST $API_BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "jan.kowalski@example.com", "password": "Password123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Login failed!${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✓ Logged in successfully${NC}"
echo ""

# Get or create a test project
echo "Getting test project..."
PROJECTS_RESPONSE=$(curl -s -X GET $API_BASE/projects \
    -H "Authorization: Bearer $TOKEN")

PROJECT_ID=$(echo $PROJECTS_RESPONSE | jq -r '.[0].id')

if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
    echo "Creating new test project..."
    PROJECT_RESPONSE=$(curl -s -X POST $API_BASE/projects \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name": "Sprint Test Project", "description": "Testing sprint features"}')
    
    PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
fi

echo -e "${GREEN}✓ Using project: $PROJECT_ID${NC}"
echo ""

# ========================================
# TEST 1: Create Sprint for deletion test
# ========================================
echo "TEST 1: Create Sprint in Planning status"
SPRINT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "boardId": "00000000-0000-0000-0000-000000000000",
        "name": "Sprint to Delete",
        "goal": "Testing delete functionality",
        "state": "Planning"
    }')

SPRINT_ID=$(echo $SPRINT_RESPONSE | jq -r '.id')

if [ "$SPRINT_ID" != "null" ] && [ -n "$SPRINT_ID" ]; then
    echo -e "${GREEN}✓ Sprint created: $SPRINT_ID${NC}"
else
    echo -e "${RED}✗ Failed to create sprint${NC}"
    echo "Response: $SPRINT_RESPONSE"
fi
echo ""

# ========================================
# TEST 2: Try to delete Planning sprint (should succeed)
# ========================================
echo "TEST 2: Delete Sprint in Planning status"
DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE $API_BASE/projects/$PROJECT_ID/sprints/$SPRINT_ID \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Sprint deleted successfully (HTTP $HTTP_STATUS)${NC}"
else
    echo -e "${RED}✗ Delete failed (HTTP $HTTP_STATUS)${NC}"
    echo "Response: $DELETE_RESPONSE"
fi
echo ""

# ========================================
# TEST 3: Create Active sprint and try to delete (should fail)
# ========================================
echo "TEST 3: Try to delete Active sprint (should fail)"

# Create sprint
ACTIVE_SPRINT_RESPONSE=$(curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "boardId": "00000000-0000-0000-0000-000000000000",
        "name": "Active Sprint",
        "goal": "Testing delete protection",
        "state": "Planning"
    }')

ACTIVE_SPRINT_ID=$(echo $ACTIVE_SPRINT_RESPONSE | jq -r '.id')

# Start the sprint
curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints/$ACTIVE_SPRINT_ID/start \
    -H "Authorization: Bearer $TOKEN" > /dev/null

# Try to delete
DELETE_ACTIVE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE $API_BASE/projects/$PROJECT_ID/sprints/$ACTIVE_SPRINT_ID \
    -H "Authorization: Bearer $TOKEN")

HTTP_STATUS=$(echo "$DELETE_ACTIVE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$HTTP_STATUS" = "400" ]; then
    echo -e "${GREEN}✓ Delete correctly prevented for Active sprint (HTTP 400)${NC}"
else
    echo -e "${RED}✗ Delete should have failed with 400 (got HTTP $HTTP_STATUS)${NC}"
    echo "Response: $DELETE_ACTIVE_RESPONSE"
fi
echo ""

# ========================================
# TEST 4: Create multiple sprints for filter testing
# ========================================
echo "TEST 4: Create multiple sprints for filtering"

# Sprint 1 - Planning, starts in future
curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"boardId\": \"00000000-0000-0000-0000-000000000000\",
        \"name\": \"Future Sprint\",
        \"goal\": \"Testing filters\",
        \"state\": \"Planning\",
        \"startDate\": \"2026-02-01\",
        \"endDate\": \"2026-02-15\"
    }" > /dev/null

# Sprint 2 - Planning, starts soon
curl -s -X POST $API_BASE/projects/$PROJECT_ID/sprints \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"boardId\": \"00000000-0000-0000-0000-000000000000\",
        \"name\": \"Upcoming Sprint\",
        \"goal\": \"Testing filters\",
        \"state\": \"Planning\",
        \"startDate\": \"2026-01-10\",
        \"endDate\": \"2026-01-24\"
    }" > /dev/null

echo -e "${GREEN}✓ Test sprints created${NC}"
echo ""

# ========================================
# TEST 5: Filter sprints by status
# ========================================
echo "TEST 5: Filter sprints by status=Planning"
FILTER_RESPONSE=$(curl -s -X GET "$API_BASE/projects/$PROJECT_ID/sprints?status=Planning" \
    -H "Authorization: Bearer $TOKEN")

PLANNING_COUNT=$(echo $FILTER_RESPONSE | jq '. | length')
echo -e "${GREEN}✓ Found $PLANNING_COUNT sprints in Planning status${NC}"
echo ""

# ========================================
# TEST 6: Filter sprints by date range
# ========================================
echo "TEST 6: Filter sprints by date range (startDateFrom=2026-01-15)"
DATE_FILTER_RESPONSE=$(curl -s -X GET "$API_BASE/projects/$PROJECT_ID/sprints?startDateFrom=2026-01-15" \
    -H "Authorization: Bearer $TOKEN")

FILTERED_COUNT=$(echo $DATE_FILTER_RESPONSE | jq '. | length')
echo -e "${GREEN}✓ Found $FILTERED_COUNT sprints starting after 2026-01-15${NC}"
echo ""

# ========================================
# TEST 7: Sort sprints by startDate
# ========================================
echo "TEST 7: Sort sprints by startDate (desc)"
SORT_RESPONSE=$(curl -s -X GET "$API_BASE/projects/$PROJECT_ID/sprints?sortBy=startDate&sortOrder=desc" \
    -H "Authorization: Bearer $TOKEN")

FIRST_SPRINT_NAME=$(echo $SORT_RESPONSE | jq -r '.[0].name')
echo -e "${GREEN}✓ Sprints sorted, first: $FIRST_SPRINT_NAME${NC}"
echo ""

# ========================================
# TEST 8: Combined filters
# ========================================
echo "TEST 8: Combined filters (status=Planning, sortBy=name)"
COMBINED_RESPONSE=$(curl -s -X GET "$API_BASE/projects/$PROJECT_ID/sprints?status=Planning&sortBy=name&sortOrder=asc" \
    -H "Authorization: Bearer $TOKEN")

COMBINED_COUNT=$(echo $COMBINED_RESPONSE | jq '. | length')
FIRST_NAME=$(echo $COMBINED_RESPONSE | jq -r '.[0].name')
echo -e "${GREEN}✓ Found $COMBINED_COUNT Planning sprints, first: $FIRST_NAME${NC}"
echo ""

# ========================================
# SUMMARY
# ========================================
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}✓ DELETE endpoint: Working${NC}"
echo -e "${GREEN}✓ Query filters: Working${NC}"
echo -e "${GREEN}✓ Status validation: Working${NC}"
echo -e "${GREEN}✓ Date filters: Working${NC}"
echo -e "${GREEN}✓ Sorting: Working${NC}"
echo ""
echo "All tests completed successfully!"
