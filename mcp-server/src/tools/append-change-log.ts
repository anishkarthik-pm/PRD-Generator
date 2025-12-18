/**
 * MCP Tool: append_change_log
 * Appends entry to Google Sheets CHANGE_LOG (append-only).
 */

import { z } from 'zod';
import { getGoogleSheetsService, ChangeLogEntry } from '../services/google-sheets.js';
import { getAuditLogger } from '../utils/audit-logger.js';
import { getLoadedBrandProfile } from './load-brand-guidelines.js';
import { getSessionSpreadsheetId } from './sync-prd-master-sheet.js';

// Tool input schema
export const AppendChangeLogInputSchema = z.object({
  version: z.string().describe('PRD version (e.g., v1.0)'),
  changedBy: z.string().describe('Name of person making the change'),
  changeSummary: z.string().describe('Summary of what changed'),
  spreadsheetId: z.string().optional().describe('Spreadsheet ID (uses session ID if not provided)'),
  prdId: z.string().optional().describe('PRD ID for audit logging'),
  approved: z.boolean().describe('User approval flag - must be true to execute'),
});

export type AppendChangeLogInput = z.infer<typeof AppendChangeLogInputSchema>;

// Tool output schema
export const AppendChangeLogOutputSchema = z.object({
  success: z.boolean(),
  spreadsheetId: z.string().optional(),
  row: z.number().optional(),
  entry: z.object({
    version: z.string(),
    date: z.string(),
    changedBy: z.string(),
    changeSummary: z.string(),
    brandVersion: z.string(),
  }).optional(),
  error: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export type AppendChangeLogOutput = z.infer<typeof AppendChangeLogOutputSchema>;

/**
 * MCP Tool handler: append_change_log
 */
export async function appendChangeLog(
  input: AppendChangeLogInput,
  actorId: string = 'claude'
): Promise<AppendChangeLogOutput> {
  const auditLogger = getAuditLogger();

  // Check approval
  if (!input.approved) {
    await auditLogger.logApproval({
      toolName: 'append_change_log',
      actorId,
      approved: false,
      reason: 'User did not approve the operation',
      prdId: input.prdId,
    });

    return {
      success: false,
      requiresApproval: true,
      error: 'Operation requires user approval. Set approved: true to proceed.',
    };
  }

  try {
    // Get spreadsheet ID
    const spreadsheetId = input.spreadsheetId || getSessionSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error('No spreadsheet ID provided and no session spreadsheet available. Sync PRD Master Sheet first.');
    }

    // Get brand profile for version
    const brandProfile = getLoadedBrandProfile();
    if (!brandProfile) {
      throw new Error('Brand guidelines must be loaded before appending to change log.');
    }

    // Create change log entry
    const entry: ChangeLogEntry = {
      version: input.version,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      changedBy: input.changedBy,
      changeSummary: input.changeSummary,
      brandVersion: brandProfile.version,
    };

    // Append to change log
    const sheetsService = getGoogleSheetsService();
    const result = await sheetsService.appendChangeLog(spreadsheetId, entry);

    // Log approval and success
    await auditLogger.logApproval({
      toolName: 'append_change_log',
      actorId,
      approved: true,
      prdId: input.prdId,
      prdVersion: input.version,
    });

    await auditLogger.logToolInvocation({
      toolName: 'append_change_log',
      actorId,
      actorType: 'claude',
      outcome: 'success',
      message: `Appended change log entry: ${input.version} - ${input.changeSummary}`,
      input: {
        version: input.version,
        changedBy: input.changedBy,
        spreadsheetId,
      },
      output: {
        result: {
          row: result.row,
        },
      },
      prdId: input.prdId,
      prdVersion: input.version,
      brandProfileVersion: brandProfile.version,
      resourcesAffected: [
        {
          type: 'google_sheet',
          id: spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=1`,
        },
      ],
      changes: [
        {
          field: 'CHANGE_LOG',
          newValue: entry,
          changeType: 'added',
        },
      ],
    });

    return {
      success: true,
      spreadsheetId,
      row: result.row,
      entry,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.logToolInvocation({
      toolName: 'append_change_log',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to append change log: ${errorMessage}`,
      input: {
        version: input.version,
        spreadsheetId: input.spreadsheetId,
      },
      severity: 'error',
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * MCP Tool definition for registration
 */
export const appendChangeLogTool = {
  name: 'append_change_log',
  description: 'Append entry to Google Sheets CHANGE_LOG. Append-only, requires user approval.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      version: {
        type: 'string',
        description: 'PRD version (e.g., v1.0)',
      },
      changedBy: {
        type: 'string',
        description: 'Name of person making the change',
      },
      changeSummary: {
        type: 'string',
        description: 'Summary of what changed',
      },
      spreadsheetId: {
        type: 'string',
        description: 'Spreadsheet ID (uses session ID if not provided)',
      },
      prdId: {
        type: 'string',
        description: 'PRD ID for audit logging',
      },
      approved: {
        type: 'boolean',
        description: 'User approval flag - must be true to execute',
      },
    },
    required: ['version', 'changedBy', 'changeSummary', 'approved'],
  },
  handler: appendChangeLog,
};
