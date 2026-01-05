#!/bin/bash

# Test Invitation System
# Tests the complete invitation flow with DB persistence

set -e

API_URL="http://localhost:4200/api"
PROJECT_ID=""
INVITATION_TOKEN=""

echo "==================================="
echo "Testing Invitation System"
echo "==================================="

# Step 1: Login as admin
echo ""
echo "[1/7] Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  -c cookies.txt)

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

# Step 2: Create a project
echo ""
echo "[2/7] Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Invitation Test Project","description":"Testing invitation system"}')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$PROJECT_ID" ]; then
  echo "✅ Project created: $PROJECT_ID"
else
  echo "❌ Failed to create project"
  echo "$PROJECT_RESPONSE"
  exit 1
fi

# Step 3: Invite a new user (doesn't exist yet)
echo ""
echo "[3/7] Sending invitation to newuser@example.com..."
INVITE_RESPONSE=$(curl -s -X POST "$API_URL/projects/$PROJECT_ID/members" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"newuser@example.com","role":"member"}')

if echo "$INVITE_RESPONSE" | grep -q "invitationId"; then
  echo "✅ Invitation created successfully"
  echo "$INVITE_RESPONSE"
else
  echo "❌ Failed to create invitation"
  echo "$INVITE_RESPONSE"
  exit 1
fi

# Step 4: List pending invitations
echo ""
echo "[4/7] Fetching pending invitations..."
INVITATIONS=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/invitations" \
  -b cookies.txt)

if echo "$INVITATIONS" | grep -q "newuser@example.com"; then
  echo "✅ Invitation appears in pending list"
  INVITATION_TOKEN=$(echo "$INVITATIONS" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4)
  echo "   Token: ${INVITATION_TOKEN:0:20}..."
else
  echo "❌ Invitation not found in pending list"
  echo "$INVITATIONS"
  exit 1
fi

# Step 5: Register the new user
echo ""
echo "[5/7] Registering new user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123","name":"New User"}')

if echo "$REGISTER_RESPONSE" | grep -q "id"; then
  echo "✅ User registered successfully"
else
  echo "❌ Failed to register user"
  echo "$REGISTER_RESPONSE"
  exit 1
fi

# Step 6: Login as new user
echo ""
echo "[6/7] Logging in as new user..."
NEW_USER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","password":"password123"}' \
  -c cookies_newuser.txt)

if echo "$NEW_USER_LOGIN" | grep -q "accessToken"; then
  echo "✅ New user logged in"
else
  echo "❌ New user login failed"
  echo "$NEW_USER_LOGIN"
  exit 1
fi

# Step 7: Accept invitation
echo ""
echo "[7/7] Accepting invitation..."
ACCEPT_RESPONSE=$(curl -s -X POST "$API_URL/projects/invitations/accept/$INVITATION_TOKEN" \
  -H "Content-Type: application/json" \
  -b cookies_newuser.txt)

if echo "$ACCEPT_RESPONSE" | grep -q "accepted"; then
  echo "✅ Invitation accepted successfully"
  echo "$ACCEPT_RESPONSE"
else
  echo "❌ Failed to accept invitation"
  echo "$ACCEPT_RESPONSE"
  exit 1
fi

# Verify membership
echo ""
echo "[VERIFY] Checking project members..."
MEMBERS=$(curl -s -X GET "$API_URL/projects/$PROJECT_ID/members" \
  -b cookies.txt)

if echo "$MEMBERS" | grep -q "newuser@example.com"; then
  echo "✅ New user is now a project member"
else
  echo "❌ New user not found in members list"
  echo "$MEMBERS"
  exit 1
fi

# Cleanup
rm -f cookies.txt cookies_newuser.txt

echo ""
echo "==================================="
echo "✅ ALL INVITATION TESTS PASSED"
echo "==================================="
