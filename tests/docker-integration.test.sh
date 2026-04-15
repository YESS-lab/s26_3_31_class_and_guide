#!/bin/bash
# Docker integration tests for the deployed Rocky agent.
#
# Prerequisites:
#   - Docker Desktop running
#   - .env file with ANTHROPIC_API_KEY
#
# Usage:
#   ./tests/docker-integration.test.sh
#
# What it tests:
#   1. Docker image builds successfully
#   2. Container starts and server listens
#   3. /api/config returns correct agent config
#   4. /api/chats CRUD works
#   5. .claude/skills/ exist inside the container
#   6. CLAUDE.md exists inside the container
#   7. Claude Code CLI is installed
#   8. Running as non-root user
#   9. Git repo is initialized
#  10. WebSocket connects
#  11. File upload works
#  12. Agent responds to a message (requires API key)
#  13. Agent responds in character as Rocky (requires API key)

set -euo pipefail

CONTAINER_NAME="rocky-integration-test"
IMAGE_NAME="rocky-agent-test"
PORT=3099
PASS=0
FAIL=0
SKIP=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${NC} $1: $2"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}SKIP${NC} $1: $2"; ((SKIP++)); }

cleanup() {
  echo ""
  echo "Cleaning up..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Check prerequisites
echo "=== Prerequisites ==="

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop first."
  exit 1
fi
pass "Docker is running"

if [ ! -f .env ]; then
  echo "Warning: No .env file found. Agent response tests will be skipped."
  HAS_API_KEY=false
else
  HAS_API_KEY=true
  pass ".env file exists"
fi

# Test 1: Build
echo ""
echo "=== Test: Docker Build ==="
if docker build -t "$IMAGE_NAME" . > /dev/null 2>&1; then
  pass "Image builds successfully"
else
  fail "Image build" "docker build failed"
  exit 1
fi

# Test 2: Start container
echo ""
echo "=== Test: Container Start ==="
if [ "$HAS_API_KEY" = true ]; then
  docker run -d --name "$CONTAINER_NAME" -p "$PORT:3001" --env-file .env "$IMAGE_NAME" > /dev/null 2>&1
else
  docker run -d --name "$CONTAINER_NAME" -p "$PORT:3001" -e ANTHROPIC_API_KEY=sk-ant-fake-key "$IMAGE_NAME" > /dev/null 2>&1
fi

# Wait for server to start
echo "  Waiting for server..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

if curl -s "http://localhost:$PORT/api/config" > /dev/null 2>&1; then
  pass "Server is listening on port $PORT"
else
  fail "Server start" "not responding after 30s"
  echo "  Container logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20
  exit 1
fi

# Test 3: Config endpoint
echo ""
echo "=== Test: API Endpoints ==="
CONFIG=$(curl -s "http://localhost:$PORT/api/config")

if echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['name']" 2>/dev/null; then
  AGENT_NAME=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  pass "/api/config returns agent name: $AGENT_NAME"
else
  fail "/api/config" "missing or invalid name field"
fi

if echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['welcome_message']" 2>/dev/null; then
  pass "/api/config has welcome_message"
else
  fail "/api/config" "missing welcome_message"
fi

if echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['persona_fields']) > 0" 2>/dev/null; then
  FIELD_COUNT=$(echo "$CONFIG" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['persona_fields']))")
  pass "/api/config has $FIELD_COUNT persona fields"
else
  fail "/api/config" "no persona_fields"
fi

# Test 4: Chat CRUD
CHAT=$(curl -s -X POST "http://localhost:$PORT/api/chats" -H "Content-Type: application/json")
CHAT_ID=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -n "$CHAT_ID" ]; then
  pass "POST /api/chats creates chat (id: ${CHAT_ID:0:8}...)"
else
  fail "POST /api/chats" "no chat ID returned"
fi

CHATS=$(curl -s "http://localhost:$PORT/api/chats")
CHAT_COUNT=$(echo "$CHATS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$CHAT_COUNT" -ge 1 ] 2>/dev/null; then
  pass "GET /api/chats lists $CHAT_COUNT chat(s)"
else
  fail "GET /api/chats" "unexpected response"
fi

DELETE_RESULT=$(curl -s -X DELETE "http://localhost:$PORT/api/chats/$CHAT_ID")
if echo "$DELETE_RESULT" | python3 -c "import sys,json; assert json.load(sys.stdin)['success']" 2>/dev/null; then
  pass "DELETE /api/chats/:id works"
else
  fail "DELETE /api/chats/:id" "delete failed"
fi

# Test 5: Container internals
echo ""
echo "=== Test: Container Internals ==="

SKILL_COUNT=$(docker exec "$CONTAINER_NAME" sh -c "ls .claude/skills/*/SKILL.md 2>/dev/null | wc -l" | tr -d ' ')
if [ "$SKILL_COUNT" -ge 3 ] 2>/dev/null; then
  pass ".claude/skills/ has $SKILL_COUNT skills"
else
  fail ".claude/skills/" "found $SKILL_COUNT skills, expected >= 3"
fi

if docker exec "$CONTAINER_NAME" sh -c "test -f CLAUDE.md && echo yes" | grep -q yes; then
  pass "CLAUDE.md exists"
else
  fail "CLAUDE.md" "not found in container"
fi

if docker exec "$CONTAINER_NAME" sh -c "test -f agent-config.json && echo yes" | grep -q yes; then
  pass "agent-config.json exists"
else
  fail "agent-config.json" "not found in container"
fi

CLAUDE_VERSION=$(docker exec "$CONTAINER_NAME" sh -c "claude --version 2>&1 | head -1")
if echo "$CLAUDE_VERSION" | grep -q "Claude Code"; then
  pass "Claude Code CLI installed: $CLAUDE_VERSION"
else
  fail "Claude Code CLI" "not found or wrong version: $CLAUDE_VERSION"
fi

WHOAMI=$(docker exec "$CONTAINER_NAME" whoami)
if [ "$WHOAMI" != "root" ]; then
  pass "Running as non-root user: $WHOAMI"
else
  fail "User" "running as root (Claude Code will reject --dangerously-skip-permissions)"
fi

GIT_STATUS=$(docker exec "$CONTAINER_NAME" sh -c "git status --short 2>&1 | head -1")
if ! echo "$GIT_STATUS" | grep -qi "fatal\|error"; then
  pass "Git repo initialized"
else
  fail "Git repo" "$GIT_STATUS"
fi

# Test 6: Frontend served
echo ""
echo "=== Test: Frontend ==="

HOMEPAGE=$(curl -s "http://localhost:$PORT/")
if echo "$HOMEPAGE" | grep -q "<!DOCTYPE html>"; then
  pass "/ serves HTML"
else
  fail "/ serves HTML" "no HTML returned"
fi

if echo "$HOMEPAGE" | grep -q "index-"; then
  pass "Built JS bundle referenced in HTML"
else
  fail "Built JS bundle" "no bundle reference found"
fi

# Test 7: File upload
echo ""
echo "=== Test: File Upload ==="

UPLOAD_CHAT=$(curl -s -X POST "http://localhost:$PORT/api/chats" -H "Content-Type: application/json")
UPLOAD_CHAT_ID=$(echo "$UPLOAD_CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

UPLOAD_RESULT=$(curl -s -X POST "http://localhost:$PORT/api/upload/$UPLOAD_CHAT_ID" \
  -H "Content-Type: text/plain" \
  -H "X-Filename: test-notes.txt" \
  --data "These are my test notes about wanting to buy a new phone.")

if echo "$UPLOAD_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['originalName'] == 'test-notes.txt'" 2>/dev/null; then
  pass "File upload succeeds"
else
  fail "File upload" "$UPLOAD_RESULT"
fi

FILES_LIST=$(curl -s "http://localhost:$PORT/api/uploads/$UPLOAD_CHAT_ID")
FILE_COUNT=$(echo "$FILES_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$FILE_COUNT" -ge 1 ] 2>/dev/null; then
  pass "Uploaded file listed ($FILE_COUNT file(s))"
else
  fail "File listing" "no files returned"
fi

# Clean up test chat
curl -s -X DELETE "http://localhost:$PORT/api/chats/$UPLOAD_CHAT_ID" > /dev/null 2>&1

# Test 8: Agent response (requires real API key)
echo ""
echo "=== Test: Agent Response ==="

if [ "$HAS_API_KEY" = false ]; then
  skip "Agent responds to message" "no API key"
  skip "Agent responds in character" "no API key"
else
  # Create a chat and send a message via WebSocket
  # We use a simple Node.js script since curl can't do WebSocket
  AGENT_CHAT=$(curl -s -X POST "http://localhost:$PORT/api/chats" -H "Content-Type: application/json")
  AGENT_CHAT_ID=$(echo "$AGENT_CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

  # Use Node.js with the ws package (available in the project) to test WebSocket
  RESPONSE=$(node -e "
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://localhost:$PORT/ws');
    let response = '';
    let done = false;
    const timeout = setTimeout(() => { console.log(response || 'TIMEOUT'); process.exit(0); }, 120000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', chatId: '$AGENT_CHAT_ID' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'chat', chatId: '$AGENT_CHAT_ID', content: 'I have been feeling stressed and thinking about buying a whole new wardrobe to feel better' }));
      }, 500);
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'assistant_delta') {
        response += msg.content;
      }
      if (msg.type === 'assistant_message_end' || msg.type === 'assistant_message') {
        if (!response && msg.content) response = msg.content;
        done = true;
      }
      if (msg.type === 'result' || msg.type === 'error') {
        if (msg.type === 'error') response = 'ERROR: ' + msg.error;
        clearTimeout(timeout);
        console.log(response);
        process.exit(0);
      }
    });
  " 2>/dev/null)

  if [ -n "$RESPONSE" ] && [ "$RESPONSE" != "TIMEOUT" ] && ! echo "$RESPONSE" | grep -q "^ERROR:"; then
    pass "Agent responds to message (${#RESPONSE} chars)"

    # Check if response sounds like Rocky (broken English, questions, short)
    RESPONSE_LOWER=$(echo "$RESPONSE" | tr '[:upper:]' '[:lower:]')
    ROCKY_SIGNALS=0
    echo "$RESPONSE_LOWER" | grep -qi "question\|rocky\|understand\|amaze\|erid" && ((ROCKY_SIGNALS++)) || true
    echo "$RESPONSE_LOWER" | grep -qi "stress\|feel\|hard\|overwhelm" && ((ROCKY_SIGNALS++)) || true
    # Check response is short (Rocky should be concise)
    SENTENCE_COUNT=$(echo "$RESPONSE" | grep -o '\.' | wc -l | tr -d ' ')
    [ "$SENTENCE_COUNT" -le 5 ] && ((ROCKY_SIGNALS++)) || true

    if [ "$ROCKY_SIGNALS" -ge 2 ]; then
      pass "Agent responds in character ($ROCKY_SIGNALS/3 Rocky signals)"
    else
      fail "Agent responds in character" "only $ROCKY_SIGNALS/3 Rocky signals. Response: ${RESPONSE:0:200}"
    fi
  elif echo "$RESPONSE" | grep -q "^ERROR:"; then
    fail "Agent responds" "$RESPONSE"
  else
    fail "Agent responds" "timeout or empty response"
    echo "  Container logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -10
  fi

  curl -s -X DELETE "http://localhost:$PORT/api/chats/$AGENT_CHAT_ID" > /dev/null 2>&1
fi

# Summary
echo ""
echo "=============================="
echo -e "  ${GREEN}PASSED: $PASS${NC}"
echo -e "  ${RED}FAILED: $FAIL${NC}"
echo -e "  ${YELLOW}SKIPPED: $SKIP${NC}"
echo "=============================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
