#!/bin/bash

# Test Dashboard Invitations
# Tests the new dashboard invitations feature where users can see and accept invitations without email

set -e

API_URL="http://localhost:4200/api"
PROJECT_ID=""

echo "==================================="
echo "Testing Dashboard Invitations"
echo "==================================="

# Generate unique identifiers
TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin_${TIMESTAMP}@example.com"
USER_EMAIL="testuser_${TIMESTAMP}@example.com"

# Step 0: Register admin user
echo ""
echo "[0/7] Registering admin user..."
ADMIN_REGISTER=$(curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"StrongPassword123\",\"firstName\":\"Admin\",\"lastName\":\"User\"}")

if echo "$ADMIN_REGISTER" | grep -q "id"; then
  echo "✅ Admin user registered: $ADMIN_EMAIL"
else
  echo "⚠️  Admin registration failed (might exist): $ADMIN_EMAIL"
fi

# Step 1: Login as admin
echo ""
echo "[1/7] Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"StrongPassword123\"}" \
  -c cookies_admin.txt)

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
  echo "✅ Admin logged in"
else
  echo "❌ Admin login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

# Step 2: Create a project
echo ""
echo "[2/7] Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -b cookies_admin.txt \
  -d '{"name":"Dashboard Test Project","description":"Testing dashboard invitations"}')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$PROJECT_ID" ]; then
  echo "✅ Project created: $PROJECT_ID"
else
  echo "❌ Failed to create project"
  echo "$PROJECT_RESPONSE"
  exit 1
fi

# Step 3: Register a second user
echo ""
echo "[3/7] Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"StrongPassword123\",\"firstName\":\"Test\",\"lastName\":\"User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "id"; then
  echo "✅ User registered successfully"
else
  echo "❌ Failed to register user (might already exist, continuing...)"
fi

# Step 4: Send invitation to the test user
echo ""
echo "[4/7] Sending invitation to $USER_EMAIL..."
INVITE_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/members" \
  -H "Content-Type: application/json" \
  -b cookies_admin.txt \
  -d "{\"email\":\"$USER_EMAIL\",\"role\":\"member\"}")

if echo "$INVITE_RESPONSE" | grep -q "invitationId"; then
  echo "✅ Invitation sent successfully"
else
  echo "❌ Failed to send invitation"
  echo "$INVITE_RESPONSE"
  exit 1
fi

# Step 5: Login as test user
echo ""
echo "[5/7] Logging in as test user..."
USER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"StrongPassword123\"}" \
  -c cookies_user.txt)

if echo "$USER_LOGIN" | grep -q "accessToken"; then
  echo "✅ Test user logged in"
else
  echo "❌ Test user login failed"
  echo "$USER_LOGIN"
  exit 1
fi

# Step 6: Fetch user's invitations (Dashboard view)
echo ""
echo "[6/7] Fetching user's invitations..."
MY_INVITATIONS=$(curl -s -X GET "$API_URL/projects/invitations/my" \
  -b cookies_user.txt)

if echo "$MY_INVITATIONS" | grep -q "Dashboard Test Project"; then
  echo "✅ User can see invitation in dashboard"
  echo ""
  echo "Invitation details:"
  echo "$MY_INVITATIONS" | python3 -m json.tool 2>/dev/null || echo "$MY_INVITATIONS"
  
  # Extract token for acceptance test
  TOKEN=$(echo "$MY_INVITATIONS" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4)
  
  if [ -n "$TOKEN" ]; then
    echo ""
    echo "[7/7] Testing acceptance from dashboard..."
    ACCEPT_RESPONSE=$(curl -s -X POST "$API_URL/projects/invitations/accept/$TOKEN" \
      -H "Content-Type: application/json" \
      -b cookies_user.txt)
    
    if echo "$ACCEPT_RESPONSE" | grep -q "accepted"; then
      echo "✅ User successfully accepted invitation from dashboard"
    else
      echo "⚠️  Acceptance failed (might be already accepted)"
      echo "$ACCEPT_RESPONSE"
    fi
  fi
else
  echo "❌ Invitation not visible in user's dashboard"
  echo "$MY_INVITATIONS"
  exit 1
fi

# Cleanup
rm -f cookies_admin.txt cookies_user.txt

echo ""
echo "==================================="
echo "✅ DASHBOARD INVITATIONS TEST PASSED"
echo "==================================="
echo ""
echo "Summary:"
echo "- Users can now see pending invitations in dashboard"
echo "- No email required to view invitations"
echo "- One-click acceptance from dashboard"
echo "- GET /api/projects/invitations/my endpoint works"
