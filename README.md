# PRD Automation System

A governed system for converting structured PRD intent into executable product artifacts using MCP (Model Context Protocol) tools.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLAUDE DESKTOP / CLAUDE CODE                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PRD Intent Layer                                                    │    │
│  │  • Accepts PRD input from user                                       │    │
│  │  • Loads brand guidelines                                            │    │
│  │  • Structures PRD deterministically                                  │    │
│  │  • Generates review artifacts                                        │    │
│  │  • Requests human approval                                           │    │
│  │  • Calls MCP tools on approval                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ MCP Protocol
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MCP SERVER (Node.js)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Brand Governance │  │   PRD Parser     │  │   Version Controller     │   │
│  │ • Load guidelines│  │ • Validate JSON  │  │ • Semantic versioning    │   │
│  │ • Validate brand │  │ • Structure data │  │ • Change detection       │   │
│  │ • Enforce rules  │  │ • Apply defaults │  │ • Downgrade prevention   │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Google Docs      │  │  Google Sheets   │  │   HTML Wireframes        │   │
│  │ • Create/Update  │  │ • PRD Master     │  │ • Low-fidelity gen       │   │
│  │ • Section mgmt   │  │ • Change log     │  │ • Brand token injection  │   │
│  │ • Version history│  │ • Append-only    │  │ • Mobile-first           │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          Audit Logger                                │    │
│  │  • All tool invocations logged • Immutable audit trail              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   Google Docs    │  │  Google Sheets   │  │    Local Filesystem      │   │
│  │   (PRD Source    │  │  (Structured     │  │    (Wireframes +         │   │
│  │    of Truth)     │  │   Data + Logs)   │  │     Audit Logs)          │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Non-Negotiable Principles

1. **Claude generates intent and structure ONLY** - No direct persistence
2. **MCP server executes persistence ONLY** - No decision making
3. **Google Docs is the primary PRD source of truth**
4. **Google Sheets is append-only for change logs**
5. **Brand guidelines are advisory but enforcing**
6. **Human approval is mandatory before writes**
7. **No hallucinated requirements or UI patterns**

## Directory Structure

```
prd-generator/
├── mcp-server/                    # MCP Server implementation
│   ├── src/
│   │   ├── index.ts               # Server entry point
│   │   ├── tools/                 # MCP tool implementations
│   │   │   ├── load-brand-guidelines.ts
│   │   │   ├── parse-prd-content.ts
│   │   │   ├── create-update-google-doc.ts
│   │   │   ├── sync-prd-master-sheet.ts
│   │   │   ├── append-change-log.ts
│   │   │   ├── generate-html-wireframes.ts
│   │   │   └── log-audit-event.ts
│   │   ├── schemas/               # JSON schemas & TypeScript types
│   │   │   ├── brand-profile.schema.ts
│   │   │   ├── prd.schema.ts
│   │   │   └── audit-event.schema.ts
│   │   ├── services/              # External service integrations
│   │   │   ├── google-auth.ts
│   │   │   ├── google-docs.ts
│   │   │   ├── google-sheets.ts
│   │   │   └── wireframe-generator.ts
│   │   ├── validators/            # Input validation
│   │   │   ├── brand-validator.ts
│   │   │   └── prd-validator.ts
│   │   └── utils/                 # Utilities
│   │       ├── version-controller.ts
│   │       └── audit-logger.ts
│   ├── package.json
│   └── tsconfig.json
├── orchestrator/                  # Orchestration logic
│   ├── orchestrator.ts
│   └── approval-flow.ts
├── brand-profiles/                # Brand profile definitions
│   └── example-retail-brand.json
├── templates/                     # Document templates
│   ├── google-docs-template.md
│   └── wireframe-templates/
├── examples/                      # Example PRDs and outputs
│   ├── cycle-count-prd/
│   │   ├── input.json
│   │   ├── structured-prd.json
│   │   └── wireframes/
│   └── sample-prd.json
├── claude-prompts/                # Claude system prompts
│   └── prd-automation-prompt.md
└── docs/                          # Documentation
    ├── setup.md
    ├── mcp-tools.md
    └── workflow.md
```

## Quick Start

1. Install dependencies:
   ```bash
   cd mcp-server && npm install
   ```

2. Configure Google credentials:
   ```bash
   cp .env.example .env
   # Add your Google Service Account credentials
   ```

3. Build the MCP server:
   ```bash
   npm run build
   ```

4. Configure Claude Desktop to use this MCP server

## MCP Tools

| Tool | Purpose |
|------|---------|
| `load_brand_guidelines` | Load and validate brand profile |
| `parse_prd_content` | Parse raw PRD into structured JSON |
| `create_or_update_google_doc` | Write PRD to Google Docs |
| `sync_prd_master_sheet` | Sync structured data to Sheets |
| `append_change_log` | Append entry to change log |
| `generate_html_wireframes` | Generate low-fi wireframes |
| `log_audit_event` | Log audit trail entry |

## License

MIT
