#!/bin/bash

# Export OpenAPI/Swagger documentation to file
# This script fetches the OpenAPI JSON and saves it to docs/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/docs"
API_URL="http://localhost:4200/api/docs-json"

# Create docs directory if it doesn't exist
mkdir -p "$DOCS_DIR"

echo "==================================="
echo "Exporting OpenAPI Documentation"
echo "==================================="

# Check if backend is running
if ! curl -s "$API_URL" > /dev/null; then
  echo "❌ Backend is not running on $API_URL"
  echo "Please start the backend first:"
  echo "  docker-compose -f docker-compose.dev.yml up -d backend"
  exit 1
fi

# Export OpenAPI JSON
echo "📄 Exporting OpenAPI JSON..."
curl -s "$API_URL" | python3 -m json.tool > "$DOCS_DIR/openapi.json"

if [ $? -eq 0 ]; then
  echo "✅ OpenAPI JSON exported to: $DOCS_DIR/openapi.json"
  
  # Count endpoints
  ENDPOINT_COUNT=$(cat "$DOCS_DIR/openapi.json" | grep -o '"operationId"' | wc -l)
  echo "📊 Total endpoints documented: $ENDPOINT_COUNT"
  
  # List tags
  echo ""
  echo "📋 API Tags:"
  cat "$DOCS_DIR/openapi.json" | grep -o '"name":"[^"]*"' | sort -u | sed 's/"name":"//;s/"//' | grep -v '^$' | head -20
  
  echo ""
  echo "🌐 Swagger UI available at: http://localhost:4200/api/docs"
  echo "📄 OpenAPI JSON available at: http://localhost:4200/api/docs-json"
else
  echo "❌ Failed to export OpenAPI documentation"
  exit 1
fi
