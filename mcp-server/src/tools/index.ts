/**
 * Tools Exports
 * Central export point for all MCP tools.
 */

// Load Brand Guidelines
export {
  loadBrandGuidelines,
  loadBrandGuidelinesTool,
  getLoadedBrandProfile,
  clearLoadedBrandProfile,
  LoadBrandGuidelinesInputSchema,
  LoadBrandGuidelinesOutputSchema,
} from './load-brand-guidelines.js';

export type {
  LoadBrandGuidelinesInput,
  LoadBrandGuidelinesOutput,
} from './load-brand-guidelines.js';

// Parse PRD Content
export {
  parsePRDContent,
  parsePRDContentTool,
  ParsePRDContentInputSchema,
  ParsePRDContentOutputSchema,
} from './parse-prd-content.js';

export type {
  ParsePRDContentInput,
  ParsePRDContentOutput,
} from './parse-prd-content.js';

// Create/Update Google Doc
export {
  createOrUpdateGoogleDoc,
  createOrUpdateGoogleDocTool,
  CreateUpdateGoogleDocInputSchema,
  CreateUpdateGoogleDocOutputSchema,
} from './create-update-google-doc.js';

export type {
  CreateUpdateGoogleDocInput,
  CreateUpdateGoogleDocOutput,
} from './create-update-google-doc.js';

// Sync PRD Master Sheet
export {
  syncPRDMasterSheet,
  syncPRDMasterSheetTool,
  getSessionSpreadsheetId,
  setSessionSpreadsheetId,
  SyncPRDMasterSheetInputSchema,
  SyncPRDMasterSheetOutputSchema,
} from './sync-prd-master-sheet.js';

export type {
  SyncPRDMasterSheetInput,
  SyncPRDMasterSheetOutput,
} from './sync-prd-master-sheet.js';

// Append Change Log
export {
  appendChangeLog,
  appendChangeLogTool,
  AppendChangeLogInputSchema,
  AppendChangeLogOutputSchema,
} from './append-change-log.js';

export type {
  AppendChangeLogInput,
  AppendChangeLogOutput,
} from './append-change-log.js';

// Generate HTML Wireframes
export {
  generateHTMLWireframes,
  generateHTMLWireframesTool,
  GenerateHTMLWireframesInputSchema,
  GenerateHTMLWireframesOutputSchema,
} from './generate-html-wireframes.js';

export type {
  GenerateHTMLWireframesInput,
  GenerateHTMLWireframesOutput,
} from './generate-html-wireframes.js';

// Log Audit Event
export {
  logAuditEvent,
  logAuditEventTool,
  getAuditHistory,
  exportAuditLog,
  LogAuditEventInputSchema,
  LogAuditEventOutputSchema,
} from './log-audit-event.js';

export type {
  LogAuditEventInput,
  LogAuditEventOutput,
} from './log-audit-event.js';

// All tools for registration
export const allTools = [
  { name: 'load_brand_guidelines', description: 'Load and validate brand profile for PRD governance' },
  { name: 'parse_prd_content', description: 'Parse raw PRD input into structured JSON format' },
  { name: 'create_or_update_google_doc', description: 'Create or update PRD document in Google Docs' },
  { name: 'sync_prd_master_sheet', description: 'Sync PRD data to Google Sheets PRD_MASTER sheet' },
  { name: 'append_change_log', description: 'Append entry to Google Sheets CHANGE_LOG' },
  { name: 'generate_html_wireframes', description: 'Generate low-fidelity HTML wireframes from PRD' },
  { name: 'log_audit_event', description: 'Log custom audit events for compliance' },
];
