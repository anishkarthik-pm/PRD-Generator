#!/bin/bash
# Quick Test Script for PRD Automation System
# Run this to verify the system is working

set -e

echo "=============================================="
echo "PRD Automation System - Quick Test"
echo "=============================================="
echo ""

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js: $NODE_VERSION"

# Check if running from correct directory
if [ ! -d "mcp-server" ]; then
    echo "❌ Error: Run this script from the PRD-Generator root directory"
    exit 1
fi
echo "   ✅ Directory structure OK"
echo ""

# Install dependencies
echo "2. Installing dependencies..."
cd mcp-server
npm install --silent
echo "   ✅ Dependencies installed"
echo ""

# Type check
echo "3. Running type check..."
npm run typecheck
echo "   ✅ TypeScript compiles"
echo ""

# Build
echo "4. Building project..."
npm run build
echo "   ✅ Build successful"
echo ""

# Check brand profile exists
echo "5. Checking example files..."
if [ -f "../brand-profiles/example-retail-brand.json" ]; then
    echo "   ✅ Brand profile exists"
else
    echo "   ❌ Brand profile missing"
    exit 1
fi

if [ -f "../examples/cycle-count-prd/input.json" ]; then
    echo "   ✅ Example PRD exists"
else
    echo "   ❌ Example PRD missing"
    exit 1
fi
echo ""

# Run local test
echo "6. Running local test..."
echo ""
npm run test:local
echo ""

echo "=============================================="
echo "All tests passed! ✅"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Configure Claude Desktop (see docs/testing.md)"
echo "  2. Add Google credentials for full integration"
echo "  3. Try the example PRD in Claude Desktop"
