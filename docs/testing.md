# Testing Guide

This guide covers how to test the PRD Automation System locally and via Claude Desktop.

## Table of Contents

1. [Quick Start (Local Testing)](#quick-start-local-testing)
2. [Testing via Claude Desktop](#testing-via-claude-desktop)
3. [Testing with Google APIs](#testing-with-google-apis)
4. [Manual Tool Testing](#manual-tool-testing)

---

## Quick Start (Local Testing)

Test the core functionality without Google API integration.

### Prerequisites

- Node.js 18+
- npm or yarn

### Steps

```bash
# 1. Navigate to mcp-server directory
cd mcp-server

# 2. Install dependencies
npm install

# 3. Run the local test
npm run test:local
```

### Expected Output

```
============================================================
PRD AUTOMATION SYSTEM - LOCAL TEST
============================================================

TEST 1: Loading Brand Guidelines...
----------------------------------------
✅ Brand loaded successfully!
   Brand: RetailOps
   Version: v1.0
   Design Principles: 4
   UI Constraints: 8
   Disallowed Patterns: Modal, Hover state, Carousel, Infinite scroll

TEST 2: Parsing PRD Content...
----------------------------------------
✅ PRD parsed successfully!
   PRD ID: prd-test-prd-user-authentication-abc123
   Version: v1.0
   Modules: 1
   Completeness Score: 85%

TEST 3: Generating Wireframes...
----------------------------------------
✅ Wireframes generated successfully!
   Output Directory: ./test-wireframes/...
   Total Pages: 2
   Files:
     - index.html
     - standard-email-login-step-1.html

TEST 4: Logging Audit Event...
----------------------------------------
✅ Audit event logged!
   Event ID: uuid-here
   Timestamp: 2024-01-20T10:00:00Z

============================================================
TEST SUMMARY
============================================================
✅ Brand Guidelines: Loaded
✅ PRD Parsing: Validated
✅ Wireframes: Generated
✅ Audit Logging: Working
```

---

## Testing via Claude Desktop

### Step 1: Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Step 2: Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS/Linux:** `~/.config/claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "prd-automation": {
      "command": "node",
      "args": ["/absolute/path/to/PRD-Generator/mcp-server/dist/index.js"],
      "env": {
        "AUDIT_LOG_DIR": "/absolute/path/to/PRD-Generator/audit-logs"
      }
    }
  }
}
```

**Important:** Use absolute paths, not relative paths.

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop completely.

### Step 4: Verify Tools are Available

In a new Claude conversation, ask:

> "What MCP tools do you have available for PRD automation?"

You should see a response listing the 7 tools.

### Step 5: Test the Workflow

Try this conversation:

**You:** Load the brand guidelines from the example-retail-brand.json file.

**Claude:** (Calls `load_brand_guidelines` tool and confirms loading)

**You:** Parse this PRD:
```
Title: Simple Login Feature
Owner: Test User
Objective: Allow users to log in
Business Value: User authentication enables personalization
Target Users: Mobile app users
In Scope: Email login, password reset
Out of Scope: Social login
Assumptions: Users have email accounts
Module: Authentication with feature Email Login (P0) with flow "Enter email and password to log in"
```

**Claude:** (Calls `parse_prd_content` and shows structured output)

**You:** Generate wireframes for this PRD.

**Claude:** (Asks for approval, then generates wireframes)

---

## Testing with Google APIs

To test full Google Docs/Sheets integration:

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Google Docs API
   - Google Sheets API
   - Google Drive API

### Step 2: Create Service Account

1. Go to IAM & Admin > Service Accounts
2. Create service account
3. Grant "Editor" role
4. Create JSON key and download

### Step 3: Configure Credentials

Option A - Environment Variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Option B - Claude Desktop Config:
```json
{
  "mcpServers": {
    "prd-automation": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "AUDIT_LOG_DIR": "/path/to/audit-logs"
      }
    }
  }
}
```

### Step 4: Test Google Integration

In Claude Desktop:

**You:** Create a Google Doc for this PRD: [paste structured PRD]

**Claude:** (Asks for approval, creates Google Doc, returns URL)

---

## Manual Tool Testing

You can also test tools manually via the MCP Inspector or by calling them directly.

### Using MCP Inspector

```bash
# Install MCP inspector if not installed
npm install -g @modelcontextprotocol/inspector

# Run inspector with your server
npx @modelcontextprotocol/inspector node dist/index.js
```

### Direct Tool Invocation

Create a test script:

```typescript
// test-specific-tool.ts
import { loadBrandGuidelines } from './src/tools/load-brand-guidelines.js';

async function test() {
  const result = await loadBrandGuidelines({
    brandProfilePath: '../brand-profiles/example-retail-brand.json'
  });
  console.log(JSON.stringify(result, null, 2));
}

test();
```

Run with:
```bash
npx tsx test-specific-tool.ts
```

---

## Test Scenarios

### Scenario 1: Brand Validation Failure

Test that PRDs violating brand guidelines are rejected:

```json
{
  "prdInput": {
    "title": "Test Modal Feature",
    "owner": "Test",
    "objective": "Show a modal dialog for confirmation",
    ...
  }
}
```

Expected: Validation error mentioning "Modal" is disallowed.

### Scenario 2: Version Downgrade Prevention

Test that version downgrades are blocked:

1. Create PRD with version v1.0
2. Try to update with version v0.9

Expected: Error "Version downgrade not allowed"

### Scenario 3: Approval Required

Test that write operations require approval:

```json
{
  "prd": {...},
  "approved": false
}
```

Expected: Response with `requiresApproval: true`

### Scenario 4: Offline Mode (Wireframes Only)

Test wireframe generation without Google credentials:

```bash
# No GOOGLE_APPLICATION_CREDENTIALS set
npm run test:local
```

Expected: Wireframes generated, Google operations skipped.

---

## Troubleshooting

### Tools Not Appearing in Claude Desktop

1. Check Claude Desktop logs: `~/.config/claude/logs/`
2. Verify absolute paths in config
3. Ensure server is built (`npm run build`)
4. Try running server directly: `node dist/index.js`

### Google API Errors

1. Verify APIs are enabled in Google Cloud Console
2. Check service account permissions
3. Ensure JSON key file exists and is readable
4. Check audit logs for detailed errors

### Validation Errors

1. Review brand profile constraints
2. Check PRD structure matches schema
3. Use `parse_prd_content` to see detailed errors

### Wireframe Not Generating

1. Check output directory is writable
2. Verify PRD has user flows defined
3. Check audit logs for generation errors
