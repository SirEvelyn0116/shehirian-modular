#!/bin/bash
# 
# Playwright Test Runner Script
# Usage: ./run-tests.sh [options]
#
# Options:
#   local     - Test against local build (http://localhost:8080)
#   prod      - Test against GitHub Pages
#   headed    - Run with visible browser
#   debug     - Run in debug mode
#   chromium  - Test only in Chromium
#   firefox   - Test only in Firefox
#   webkit    - Test only in WebKit
#   report    - Open test report
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
LOCAL_URL="http://localhost:8080"
PROD_URL="https://sirevelyn0116.github.io/shehirian-modular"

echo -e "${GREEN}🎭 Playwright Test Runner${NC}"
echo "================================"

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Error: npx not found. Install Node.js first.${NC}"
    exit 1
fi

# Parse arguments
MODE=${1:-prod}
EXTRA_ARGS=""

case $MODE in
  local)
    echo -e "${YELLOW}📍 Testing against: LOCAL (${LOCAL_URL})${NC}"
    
    # Check if local server is running
    if ! curl -s "${LOCAL_URL}" > /dev/null; then
      echo -e "${RED}❌ Local server not running!${NC}"
      echo "Start it with: npm run preview"
      exit 1
    fi
    
    export BASE_URL="${LOCAL_URL}"
    ;;
    
  prod)
    echo -e "${YELLOW}📍 Testing against: PRODUCTION (${PROD_URL})${NC}"
    export BASE_URL="${PROD_URL}"
    ;;
    
  headed)
    echo -e "${YELLOW}👀 Running in HEADED mode${NC}"
    EXTRA_ARGS="--headed"
    export BASE_URL="${PROD_URL}"
    ;;
    
  debug)
    echo -e "${YELLOW}🐛 Running in DEBUG mode${NC}"
    EXTRA_ARGS="--debug"
    export BASE_URL="${PROD_URL}"
    ;;
    
  chromium|firefox|webkit)
    echo -e "${YELLOW}🌐 Testing in: ${MODE}${NC}"
    EXTRA_ARGS="--project=${MODE}"
    export BASE_URL="${PROD_URL}"
    ;;
    
  report)
    echo -e "${GREEN}📊 Opening test report...${NC}"
    npx playwright show-report test-results/html
    exit 0
    ;;
    
  *)
    echo -e "${RED}❌ Unknown option: ${MODE}${NC}"
    echo ""
    echo "Usage: $0 [local|prod|headed|debug|chromium|firefox|webkit|report]"
    exit 1
    ;;
esac

echo "================================"
echo ""

# Run tests
echo -e "${GREEN}🚀 Running tests...${NC}"
npx playwright test ${EXTRA_ARGS}

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "View report: npx playwright show-report test-results/html"
  exit 0
else
  echo ""
  echo -e "${RED}❌ Some tests failed!${NC}"
  echo ""
  echo "View report: npx playwright show-report test-results/html"
  echo "Debug: $0 debug"
  exit 1
fi
