/**
 * PRD Automation MCP Server
 * Entry point for the Model Context Protocol server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { loadBrandGuidelinesTool, loadBrandGuidelines } from './tools/load-brand-guidelines.js';
import { parsePRDContentTool, parsePRDContent } from './tools/parse-prd-content.js';
import { createOrUpdateGoogleDocTool, createOrUpdateGoogleDoc } from './tools/create-update-google-doc.js';
import { syncPRDMasterSheetTool, syncPRDMasterSheet } from './tools/sync-prd-master-sheet.js';
import { appendChangeLogTool, appendChangeLog } from './tools/append-change-log.js';
import { generateHTMLWireframesTool, generateHTMLWireframes } from './tools/generate-html-wireframes.js';
import { logAuditEventTool, logAuditEvent } from './tools/log-audit-event.js';

// Import services
import { getGoogleAuthService } from './services/google-auth.js';
import { getAuditLogger } from './utils/audit-logger.js';

// Tool registry
const tools = [
  loadBrandGuidelinesTool,
  parsePRDContentTool,
  createOrUpdateGoogleDocTool,
  syncPRDMasterSheetTool,
  appendChangeLogTool,
  generateHTMLWireframesTool,
  logAuditEventTool,
];

// Tool handlers map
const toolHandlers: Record<string, (args: unknown, actorId?: string) => Promise<unknown>> = {
  load_brand_guidelines: loadBrandGuidelines,
  parse_prd_content: parsePRDContent,
  create_or_update_google_doc: createOrUpdateGoogleDoc,
  sync_prd_master_sheet: syncPRDMasterSheet,
  append_change_log: appendChangeLog,
  generate_html_wireframes: generateHTMLWireframes,
  log_audit_event: logAuditEvent,
};

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'prd-automation-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args, 'claude');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  // Initialize audit logger
  const auditLogger = getAuditLogger({
    logDirectory: process.env.AUDIT_LOG_DIR || './audit-logs',
    enableConsoleOutput: process.env.NODE_ENV !== 'production',
  });

  // Initialize Google Auth if credentials are available
  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    const authService = getGoogleAuthService();
    try {
      await authService.initialize();
      const verification = await authService.verifyCredentials();
      if (verification.valid) {
        console.error(`[PRD-MCP] Google auth initialized: ${verification.email}`);
      } else {
        console.error(`[PRD-MCP] Google auth verification failed: ${verification.error}`);
      }
    } catch (error) {
      console.error('[PRD-MCP] Google auth initialization failed:', error);
    }
  } else {
    console.error('[PRD-MCP] No Google credentials configured. Google Docs/Sheets tools will fail.');
  }

  // Log server startup
  await auditLogger.logToolInvocation({
    toolName: 'log_audit_event',
    actorId: 'system',
    actorType: 'system',
    outcome: 'success',
    message: 'PRD Automation MCP Server started',
    input: {},
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.error('[PRD-MCP] Starting PRD Automation MCP Server...');

  // Initialize services
  await initializeServices();

  // Create server
  const server = createServer();

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error('[PRD-MCP] Server running on stdio transport');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('[PRD-MCP] Shutting down...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('[PRD-MCP] Shutting down...');
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error('[PRD-MCP] Fatal error:', error);
  process.exit(1);
});
