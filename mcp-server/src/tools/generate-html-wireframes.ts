/**
 * MCP Tool: generate_html_wireframes
 * Generates low-fidelity HTML wireframes from PRD user flows.
 */

import { z } from 'zod';
import { PRD, PRDSchema } from '../schemas/prd.schema.js';
import { getWireframeGenerator } from '../services/wireframe-generator.js';
import { getAuditLogger } from '../utils/audit-logger.js';
import { getLoadedBrandProfile } from './load-brand-guidelines.js';

// Tool input schema
export const GenerateHTMLWireframesInputSchema = z.object({
  prd: z.any().describe('Structured PRD object'),
  outputDirectory: z.string().optional().describe('Custom output directory'),
  approved: z.boolean().describe('User approval flag - must be true to execute'),
});

export type GenerateHTMLWireframesInput = z.infer<typeof GenerateHTMLWireframesInputSchema>;

// Tool output schema
export const GenerateHTMLWireframesOutputSchema = z.object({
  success: z.boolean(),
  outputDirectory: z.string().optional(),
  totalPages: z.number().optional(),
  files: z.array(z.object({
    fileName: z.string(),
    filePath: z.string(),
    flowName: z.string(),
    stepNumber: z.number(),
    title: z.string(),
  })).optional(),
  error: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export type GenerateHTMLWireframesOutput = z.infer<typeof GenerateHTMLWireframesOutputSchema>;

/**
 * MCP Tool handler: generate_html_wireframes
 */
export async function generateHTMLWireframes(
  input: GenerateHTMLWireframesInput,
  actorId: string = 'claude'
): Promise<GenerateHTMLWireframesOutput> {
  const auditLogger = getAuditLogger();

  // Check approval
  if (!input.approved) {
    await auditLogger.logApproval({
      toolName: 'generate_html_wireframes',
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
      throw new Error('Brand guidelines must be loaded before generating wireframes.');
    }

    // Get wireframe generator with custom output directory if provided
    const generator = getWireframeGenerator({
      outputDirectory: input.outputDirectory || './wireframes',
    });

    // Generate wireframes
    const result = await generator.generateWireframes(prd, brandProfile);

    // Log approval and success
    await auditLogger.logApproval({
      toolName: 'generate_html_wireframes',
      actorId,
      approved: true,
      prdId: prd.prdId,
      prdVersion: prd.version,
    });

    await auditLogger.logToolInvocation({
      toolName: 'generate_html_wireframes',
      actorId,
      actorType: 'claude',
      outcome: 'success',
      message: `Generated ${result.totalPages} wireframe pages for ${prd.title}`,
      input: {
        prdId: prd.prdId,
        outputDirectory: input.outputDirectory,
      },
      output: {
        result: {
          outputDirectory: result.outputDirectory,
          totalPages: result.totalPages,
        },
      },
      prdId: prd.prdId,
      prdVersion: prd.version,
      brandProfileVersion: brandProfile.version,
      resourcesAffected: result.files.map(f => ({
        type: 'html_file' as const,
        id: f.fileName,
        url: f.filePath,
      })),
    });

    return {
      success: true,
      outputDirectory: result.outputDirectory,
      totalPages: result.totalPages,
      files: result.files,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.logToolInvocation({
      toolName: 'generate_html_wireframes',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to generate wireframes: ${errorMessage}`,
      input: {
        prdId: input.prd?.prdId,
        outputDirectory: input.outputDirectory,
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
export const generateHTMLWireframesTool = {
  name: 'generate_html_wireframes',
  description: 'Generate low-fidelity HTML wireframes from PRD user flows. Requires user approval.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prd: {
        type: 'object',
        description: 'Structured PRD object',
      },
      outputDirectory: {
        type: 'string',
        description: 'Custom output directory for wireframes',
      },
      approved: {
        type: 'boolean',
        description: 'User approval flag - must be true to execute',
      },
    },
    required: ['prd', 'approved'],
  },
  handler: generateHTMLWireframes,
};
