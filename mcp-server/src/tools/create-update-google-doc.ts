/**
 * MCP Tool: create_or_update_google_doc
 * Creates or updates PRD document in Google Docs.
 */

import { z } from 'zod';
import { PRD, PRDSchema } from '../schemas/prd.schema.js';
import { getGoogleDocsService } from '../services/google-docs.js';
import { getAuditLogger } from '../utils/audit-logger.js';
import { getLoadedBrandProfile } from './load-brand-guidelines.js';

// Tool input schema
export const CreateUpdateGoogleDocInputSchema = z.object({
  prd: z.any().describe('Structured PRD object'),
  documentId: z.string().optional().describe('Existing document ID for updates'),
  shareWith: z.array(z.string()).optional().describe('Email addresses to share with'),
  approved: z.boolean().describe('User approval flag - must be true to execute'),
});

export type CreateUpdateGoogleDocInput = z.infer<typeof CreateUpdateGoogleDocInputSchema>;

// Tool output schema
export const CreateUpdateGoogleDocOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string().optional(),
  documentUrl: z.string().optional(),
  operation: z.enum(['created', 'updated']).optional(),
  title: z.string().optional(),
  error: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export type CreateUpdateGoogleDocOutput = z.infer<typeof CreateUpdateGoogleDocOutputSchema>;

/**
 * MCP Tool handler: create_or_update_google_doc
 */
export async function createOrUpdateGoogleDoc(
  input: CreateUpdateGoogleDocInput,
  actorId: string = 'claude'
): Promise<CreateUpdateGoogleDocOutput> {
  const auditLogger = getAuditLogger();

  // Check approval
  if (!input.approved) {
    await auditLogger.logApproval({
      toolName: 'create_or_update_google_doc',
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
      throw new Error('Brand guidelines must be loaded before creating documents.');
    }

    const docsService = getGoogleDocsService();
    let result: CreateUpdateGoogleDocOutput;

    if (input.documentId) {
      // Update existing document
      const updateResult = await docsService.updatePRDDocument(input.documentId, prd);

      result = {
        success: updateResult.success,
        documentId: input.documentId,
        documentUrl: `https://docs.google.com/document/d/${input.documentId}/edit`,
        operation: 'updated',
        title: prd.title,
      };
    } else {
      // Create new document
      const createResult = await docsService.createPRDDocument(prd);

      result = {
        success: true,
        documentId: createResult.documentId,
        documentUrl: createResult.documentUrl,
        operation: 'created',
        title: createResult.title,
      };
    }

    // Share document if emails provided
    if (input.shareWith && input.shareWith.length > 0 && result.documentId) {
      await docsService.shareDocument(result.documentId, input.shareWith, 'writer');
    }

    // Log approval and success
    await auditLogger.logApproval({
      toolName: 'create_or_update_google_doc',
      actorId,
      approved: true,
      prdId: prd.prdId,
      prdVersion: prd.version,
    });

    await auditLogger.logToolInvocation({
      toolName: 'create_or_update_google_doc',
      actorId,
      actorType: 'claude',
      outcome: 'success',
      message: `${result.operation === 'created' ? 'Created' : 'Updated'} Google Doc: ${prd.title}`,
      input: {
        prdId: prd.prdId,
        documentId: input.documentId,
        operation: result.operation,
      },
      output: {
        result: {
          documentId: result.documentId,
          documentUrl: result.documentUrl,
        },
      },
      prdId: prd.prdId,
      prdVersion: prd.version,
      brandProfileVersion: brandProfile.version,
      resourcesAffected: [
        {
          type: 'google_doc',
          id: result.documentId!,
          url: result.documentUrl,
          version: prd.version,
        },
      ],
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.logToolInvocation({
      toolName: 'create_or_update_google_doc',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to create/update Google Doc: ${errorMessage}`,
      input: {
        prdId: input.prd?.prdId,
        documentId: input.documentId,
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
export const createOrUpdateGoogleDocTool = {
  name: 'create_or_update_google_doc',
  description: 'Create or update PRD document in Google Docs. Requires user approval.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prd: {
        type: 'object',
        description: 'Structured PRD object',
      },
      documentId: {
        type: 'string',
        description: 'Existing document ID for updates (omit for new document)',
      },
      shareWith: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses to share the document with',
      },
      approved: {
        type: 'boolean',
        description: 'User approval flag - must be true to execute',
      },
    },
    required: ['prd', 'approved'],
  },
  handler: createOrUpdateGoogleDoc,
};
