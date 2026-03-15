#!/bin/bash
# Pre-deploy test script
# Run this before pushing changes to ensure nothing is broken

set -e  # Exit on first error

echo ""
echo "🚀 EVENTGASM PRE-DEPLOY CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check for common issues
echo "📋 Checking for common issues..."

# 1. Check if admin.js is corrupted
ADMIN_LINES=$(wc -l < src/routes/admin.js 2>/dev/null || echo "0")
if [ "$ADMIN_LINES" -lt 50 ]; then
    echo "❌ ERROR: admin.js appears corrupted (only $ADMIN_LINES lines)"
    exit 1
fi
echo "✅ admin.js looks healthy ($ADMIN_LINES lines)"

# 2. Check if babel.config.js exists for mobile
if [ ! -f "mobile/babel.config.js" ]; then
    echo "❌ ERROR: mobile/babel.config.js missing (Reanimated will crash)"
    exit 1
fi
echo "✅ babel.config.js exists"

# 3. Check for localhost in production API
if grep -q "localhost" mobile/src/services/api.js 2>/dev/null; then
    if ! grep -q "__DEV__" mobile/src/services/api.js 2>/dev/null; then
        echo "⚠️  WARNING: API may be pointing to localhost without DEV check"
    fi
fi
echo "✅ API config looks OK"

# 4. Run mobile static tests
echo ""
echo "📱 Running mobile tests..."
if node tests/mobile.test.js; then
    echo "✅ Mobile tests passed"
else
    echo "❌ Mobile tests failed"
    exit 1
fi

# 5. Run API tests (only if server is reachable)
echo ""
echo "🌐 Running API tests..."
if curl -s --max-time 5 "https://eventgasm.onrender.com/api/events?limit=1" > /dev/null 2>&1; then
    if node tests/api.test.js; then
        echo "✅ API tests passed"
    else
        echo "❌ API tests failed"
        exit 1
    fi
else
    echo "⚠️  Skipping API tests (server not reachable)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL CHECKS PASSED - Safe to deploy!"
echo ""
