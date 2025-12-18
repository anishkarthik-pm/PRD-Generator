# Setup Guide

## Prerequisites

- Node.js 18+ installed
- Google Cloud Project with:
  - Google Docs API enabled
  - Google Sheets API enabled
  - Google Drive API enabled
- Service Account with Editor access to target Drive folder

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prd-generator
   ```

2. **Install dependencies**
   ```bash
   cd mcp-server
   npm install
   ```

3. **Configure Google credentials**

   Create a service account in Google Cloud Console:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Grant "Editor" role
   - Create and download JSON key

   Copy the key file:
   ```bash
   cp /path/to/downloaded-key.json ./credentials/service-account.json
   ```

   Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env and set GOOGLE_APPLICATION_CREDENTIALS path
   ```

4. **Build the server**
   ```bash
   npm run build
   ```

## Claude Desktop Configuration

Add the MCP server to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on Linux/Mac or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "prd-automation": {
      "command": "node",
      "args": ["/path/to/prd-generator/mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "AUDIT_LOG_DIR": "/path/to/audit-logs"
      }
    }
  }
}
```

## Verify Installation

1. Restart Claude Desktop
2. Open a new conversation
3. The PRD automation tools should be available
4. Test with: "Load the RetailOps brand guidelines"

## Directory Setup

Create required directories:
```bash
mkdir -p audit-logs
mkdir -p wireframes
mkdir -p brand-profiles
```

Copy example brand profile:
```bash
cp brand-profiles/example-retail-brand.json brand-profiles/retailops.json
```

## Troubleshooting

### Tools not appearing in Claude Desktop
- Check Claude Desktop logs for MCP connection errors
- Verify the path in config is correct
- Ensure Node.js is in your PATH

### Google API errors
- Verify service account has correct permissions
- Check that APIs are enabled in Google Cloud Console
- Ensure service account JSON is valid

### Audit log errors
- Verify AUDIT_LOG_DIR exists and is writable
- Check disk space availability
