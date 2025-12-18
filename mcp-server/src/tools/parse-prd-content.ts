/**
 * MCP Tool: parse_prd_content
 * Parses raw PRD input into structured JSON format.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  PRD,
  PRDInput,
  PRDInputSchema,
  generatePRDId,
  Feature,
  Module,
  UserFlow,
  UserFlowStep,
} from '../schemas/prd.schema.js';
import { getLoadedBrandProfile } from './load-brand-guidelines.js';
import { validatePRDAgainstBrand } from '../validators/brand-validator.js';
import { validatePRD } from '../validators/prd-validator.js';
import { getAuditLogger } from '../utils/audit-logger.js';

// Tool input schema
export const ParsePRDContentInputSchema = z.object({
  prdInput: PRDInputSchema.describe('Raw PRD input data'),
  existingPrdId: z.string().optional().describe('Existing PRD ID for updates'),
  baseVersion: z.string().optional().describe('Base version for updates (e.g., v1.0)'),
});

export type ParsePRDContentInput = z.infer<typeof ParsePRDContentInputSchema>;

// Tool output schema
export const ParsePRDContentOutputSchema = z.object({
  success: z.boolean(),
  prd: z.any().optional(), // Full PRD object
  validationResult: z.object({
    structureValid: z.boolean(),
    brandValid: z.boolean(),
    completenessScore: z.number(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }).optional(),
  error: z.string().optional(),
});

export type ParsePRDContentOutput = z.infer<typeof ParsePRDContentOutputSchema>;

/**
 * Transform raw PRD input into structured PRD format
 */
function transformToPRD(input: PRDInput, prdId: string, version: string): PRD {
  const now = new Date().toISOString();
  const brandProfile = getLoadedBrandProfile();

  // Transform modules and features
  const modules: Module[] = input.modules.map((mod, modIndex) => {
    const moduleId = `mod-${modIndex + 1}-${slugify(mod.name)}`;

    const features: Feature[] = mod.features.map((feat, featIndex) => {
      const featureId = `feat-${modIndex + 1}-${featIndex + 1}-${slugify(feat.name)}`;

      // Transform flows
      const userFlows: UserFlow[] = feat.flows.map(flow => ({
        flowName: flow.name,
        description: flow.description,
        steps: flow.steps.map((step, stepIndex): UserFlowStep => ({
          stepNumber: stepIndex + 1,
          action: step,
          expectedResult: 'User sees expected outcome', // Default, should be enhanced
        })),
      }));

      // Transform edge cases
      const edgeCases = feat.edgeCases?.map(ec => ({
        scenario: ec,
        expectedBehavior: 'Handle gracefully',
        priority: 'medium' as const,
      }));

      // Transform success metrics
      const successMetrics = feat.successMetrics?.map(sm => ({
        metric: sm,
        target: 'TBD',
        measurementMethod: 'TBD',
      }));

      return {
        featureId,
        featureName: feat.name,
        description: feat.description,
        priority: feat.priority,
        userFlows,
        edgeCases,
        successMetrics,
        status: 'draft' as const,
      };
    });

    return {
      moduleId,
      moduleName: mod.name,
      description: mod.description,
      features,
    };
  });

  // Build PRD object
  const prd: PRD = {
    prdId,
    title: input.title,
    version,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    owner: input.owner,

    objective: {
      statement: input.objective,
      businessValue: input.businessValue,
      targetUsers: input.targetUsers,
    },

    inScope: input.inScope.map(item => ({ item })),
    outOfScope: input.outOfScope.map(item => ({ item })),

    assumptions: input.assumptions.map(assumption => ({
      assumption,
      risk: 'medium' as const,
    })),

    brandContext: {
      brandName: brandProfile?.brandName || 'Unknown',
      guidelinesVersion: brandProfile?.version || 'v0.0',
      uiConstraints: brandProfile?.uiPatternConstraints
        .filter(c => !c.allowed)
        .map(c => `No ${c.pattern}: ${c.reason}`) || [],
    },

    modules,

    versionHistory: [
      {
        version,
        date: now,
        changedBy: input.owner,
        summary: 'Initial PRD creation',
      },
    ],
  };

  return prd;
}

/**
 * Helper to create URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * MCP Tool handler: parse_prd_content
 */
export async function parsePRDContent(
  input: ParsePRDContentInput,
  actorId: string = 'claude'
): Promise<ParsePRDContentOutput> {
  const auditLogger = getAuditLogger();

  try {
    // Check if brand guidelines are loaded
    const brandProfile = getLoadedBrandProfile();
    if (!brandProfile) {
      throw new Error('Brand guidelines must be loaded before parsing PRD. Call load_brand_guidelines first.');
    }

    // Validate raw input
    const validatedInput = PRDInputSchema.parse(input.prdInput);

    // Generate or use existing PRD ID
    const prdId = input.existingPrdId || generatePRDId(validatedInput.title);
    const version = input.baseVersion || 'v1.0';

    // Transform to structured PRD
    const prd = transformToPRD(validatedInput, prdId, version);

    // Validate PRD structure
    const structureValidation = validatePRD(prd);

    // Validate against brand guidelines
    const brandValidation = validatePRDAgainstBrand(prd, brandProfile);

    // Combine errors and warnings
    const allErrors = [
      ...structureValidation.errors.map(e => `[Structure] ${e.message}`),
      ...brandValidation.errors.map(e => `[Brand] ${e.message}`),
    ];

    const allWarnings = [
      ...structureValidation.warnings.map(w => `[Structure] ${w.message}`),
      ...brandValidation.warnings.map(w => `[Brand] ${w.message}`),
    ];

    const isValid = structureValidation.valid && brandValidation.valid;

    // Log the operation
    await auditLogger.logToolInvocation({
      toolName: 'parse_prd_content',
      actorId,
      actorType: 'claude',
      outcome: isValid ? 'success' : 'rejected',
      message: isValid
        ? `Successfully parsed PRD: ${prd.title}`
        : `PRD validation failed with ${allErrors.length} error(s)`,
      input: {
        title: validatedInput.title,
        modulesCount: validatedInput.modules.length,
        existingPrdId: input.existingPrdId,
      },
      prdId,
      prdVersion: version,
      brandProfileVersion: brandProfile.version,
    });

    if (!isValid) {
      // Log validation failure details
      await auditLogger.logValidationFailure({
        toolName: 'parse_prd_content',
        actorId,
        validationErrors: allErrors,
        input: { title: validatedInput.title },
        prdId,
      });
    }

    return {
      success: isValid,
      prd: isValid ? prd : undefined,
      validationResult: {
        structureValid: structureValidation.valid,
        brandValid: brandValidation.valid,
        completenessScore: structureValidation.completenessScore,
        errors: allErrors,
        warnings: allWarnings,
      },
      error: isValid ? undefined : `Validation failed: ${allErrors.join('; ')}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await auditLogger.logToolInvocation({
      toolName: 'parse_prd_content',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to parse PRD: ${errorMessage}`,
      input: {
        hasInput: !!input.prdInput,
        existingPrdId: input.existingPrdId,
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
export const parsePRDContentTool = {
  name: 'parse_prd_content',
  description: 'Parse raw PRD input into structured JSON format. Validates against brand guidelines.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      prdInput: {
        type: 'object',
        description: 'Raw PRD input data with title, objective, modules, etc.',
        properties: {
          title: { type: 'string' },
          owner: { type: 'string' },
          objective: { type: 'string' },
          businessValue: { type: 'string' },
          targetUsers: { type: 'array', items: { type: 'string' } },
          inScope: { type: 'array', items: { type: 'string' } },
          outOfScope: { type: 'array', items: { type: 'string' } },
          assumptions: { type: 'array', items: { type: 'string' } },
          modules: { type: 'array' },
        },
        required: ['title', 'owner', 'objective', 'businessValue', 'targetUsers', 'inScope', 'outOfScope', 'assumptions', 'modules'],
      },
      existingPrdId: {
        type: 'string',
        description: 'Existing PRD ID for updates',
      },
      baseVersion: {
        type: 'string',
        description: 'Base version for updates (e.g., v1.0)',
      },
    },
    required: ['prdInput'],
  },
  handler: parsePRDContent,
};
