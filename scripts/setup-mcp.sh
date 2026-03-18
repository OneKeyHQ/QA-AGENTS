#!/bin/bash
set -e

echo "=== OneKey Agent Test - MCP Setup ==="
echo ""

# Check for OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
  read -rp "Enter your OpenAI API Key: " OPENAI_API_KEY
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is required"
  exit 1
fi

echo ""
echo "Registering Midscene Web MCP server..."
claude mcp add --transport stdio midscene-web \
  --env MIDSCENE_MODEL_NAME=gpt-4o-2024-11-20 \
  --env OPENAI_API_KEY="$OPENAI_API_KEY" \
  --env MCP_SERVER_REQUEST_TIMEOUT=800000 \
  -- npx -y @midscene/mcp

echo "Web MCP registered."

echo ""
read -rp "Setup Android MCP too? (y/n): " SETUP_ANDROID
if [ "$SETUP_ANDROID" = "y" ]; then
  echo "Registering Midscene Android MCP server..."
  claude mcp add --transport stdio midscene-android \
    --env MIDSCENE_MODEL_NAME=gpt-4o-2024-11-20 \
    --env OPENAI_API_KEY="$OPENAI_API_KEY" \
    --env MIDSCENE_MCP_ANDROID_MODE=true \
    --env MCP_SERVER_REQUEST_TIMEOUT=800000 \
    -- npx -y @midscene/mcp
  echo "Android MCP registered."
fi

echo ""
echo "Done! Run 'claude mcp list' to verify."
