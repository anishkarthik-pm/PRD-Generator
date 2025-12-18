/**
 * MCP Tool: sync_prd_master_sheet
 * Syncs PRD data to Google Sheets PRD_MASTER sheet.
 */

import { z } from 'zod';
import { PRD, PRDSchema } from '../schemas/prd.schema.js';
import { getGoogleSheetsService } from '../services/google-sheets.js';
import { getAuditLogger } from '../utils/audit-logger.js';
import { getLoadedBrandProfile } from './load-brand-guidelines.js';

// Tool input schema
export const SyncPRDMasterSheetInputSchema = z.object({
  prd: z.any().describe('Structured PRD object'),
  spreadsheetId: z.string().optional().describe('Existing spreadsheet ID'),
  createIfNotExists: z.boolean().default(true).describe('Create spreadsheet if it does not exist'),
  approved: z.boolean().describe('User approval flag - must be true to execute'),
});

export type SyncPRDMasterSheetInput = z.infer<typeof SyncPRDMasterSheetInputSchema>;

// Tool output schema
export const SyncPRDMasterSheetOutputSchema = z.object({
  success: z.boolean(),
  spreadsheetId: z.string().optional(),
  spreadsheetUrl: z.string().optional(),
  rowsUpdated: z.number().optional(),
  operation: z.enum(['created', 'synced']).optional(),
  error: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export type SyncPRDMasterSheetOutput = z.infer<typeof SyncPRDMasterSheetOutputSchema>;

// Store spreadsheet ID for session
let sessionSpreadsheetId: string | null = null;

export function getSessionSpreadsheetId(): string | null {
  return sessionSpreadsheetId;
}

export function setSessionSpreadsheetId(id: string): void {
  sessionSpreadsheetId = id;
}

/**
 * MCP Tool handler: sync_prd_master_sheet
 */
export async function syncPRDMasterSheet(
  input: SyncPRDMasterSheetInput,
  actorId: string = 'claude'
): Promise<SyncPRDMasterSheetOutput> {
  const auditLogger = getAuditLogger();

  // Check approval
  if (!input.approved) {
    await auditLogger.logApproval({
      toolName: 'sync_prd_master_sheet',
      actorId,
      approved: false,
      reason: 'User did not approve the operation',
      prdId: input.prd?.prdId,
    });

    return {
      success: false,
      requiresApproval: true,
      error: 'Operation requires user approval. Set approved: true to proceed.',
    };
  }

  try {
    // Validate PRD structure
    const prd = PRDSchema.parse(input.prd) as PRD;

    // Check brand guidelines are loaded
    const brandProfile = getLoadedBrandProfile();
    if (!brandProfile) {
      throw new Error('Brand guidelines must be loaded before syncing to sheets.');
    }

    const sheetsService = getGoogleSheetsService();
    let spreadsheetId = input.spreadsheetId || sessionSpreadsheetId;
    let operation: 'created' | 'synced' = 'synced';

    // Create spreadsheet if needed
    if (!spreadsheetId && input.createIfNotExists) {
      const createResult = await sheetsService.createPRDSpreadsheet(prd.title);
      spreadsheetId = createResult.spreadsheetId;
      sessionSpreadsheetId = spreadsheetId;
      operation = 'created';
    }

    if (!spreadsheetId) {
      throw new Error('No spreadsheet ID provided and createIfNotExists is false');
    }

    // Sync PRD data
    const syncResult = await sheetsService.syncPRDMaster(spreadsheetId, prd);

    // Log approval and success
    await auditLogger.logApproval({
      toolName: 'sync_prd_master_sheet',
      actorId,
      approved: true,
      prdId: prd.prdId,
      prdVersion: prd.version,
    });

    await auditLogger.logToolInvocation({
      toolName: 'sync_prd_master_sheet',
      actorId,
      actorType: 'claude',
      outcome: 'success',
      message: `${operation === 'created' ? 'Created' : 'Synced'} PRD Master Sheet: ${syncResult.rowsUpdated} rows`,
      input: {
        prdId: prd.prdId,
        spreadsheetId: input.spreadsheetId,
        operation,
      },
      output: {
        result: {
          spreadsheetId,
          rowsUpdated: syncResult.rowsUpdated,
        },
      },
      prdId: prd.prdId,
      prdVersion: prd.version,
      brandProfileVersion: brandProfile.version,
      resourcesAffected: [
        {
          type: 'google_sheet',
          id: spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          version: prd.version,
        },
      ],
    });

    return {
      success: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      rowsUpdated: syncResult.rowsUpdated,
      operation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.logToolInvocation({
      toolName: 'sync_prd_master_sheet',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to sync PRD Master Sheet: ${errorMessage}`,
      input: {
        prdId: input.prd?.prdId,
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
export const syncPRDMasterSheetTool = {
  name: 'sync_prd_master_sheet',
  description: 'Sync PRD data to Google Sheets PRD_MASTER sheet. Requires user approval.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prd: {
        type: 'object',
        description: 'Structured PRD object',
      },
      spreadsheetId: {
        type: 'string',
        description: 'Existing spreadsheet ID (will use session ID if not provided)',
      },
      createIfNotExists: {
        type: 'boolean',
        description: 'Create spreadsheet if it does not exist',
        default: true,
      },
      approved: {
        type: 'boolean',
        description: 'User approval flag - must be true to execute',
      },
    },
    required: ['prd', 'approved'],
  },
  handler: syncPRDMasterSheet,
};
