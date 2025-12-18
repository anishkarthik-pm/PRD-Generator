/**
 * MCP Tool: load_brand_guidelines
 * Loads and validates brand profile for PRD governance.
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { BrandProfile, validateBrandProfile, BrandProfileSchema } from '../schemas/brand-profile.schema.js';
import { getAuditLogger } from '../utils/audit-logger.js';

// Tool input schema
export const LoadBrandGuidelinesInputSchema = z.object({
  brandProfilePath: z.string().optional().describe('Path to brand profile JSON file'),
  brandProfileJson: z.string().optional().describe('Brand profile as JSON string'),
  brandName: z.string().optional().describe('Brand name to load from default profiles'),
});

export type LoadBrandGuidelinesInput = z.infer<typeof LoadBrandGuidelinesInputSchema>;

// Tool output schema
export const LoadBrandGuidelinesOutputSchema = z.object({
  success: z.boolean(),
  brandProfile: BrandProfileSchema.optional(),
  brandName: z.string().optional(),
  version: z.string().optional(),
  designPrinciplesCount: z.number().optional(),
  uiConstraintsCount: z.number().optional(),
  disallowedPatterns: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type LoadBrandGuidelinesOutput = z.infer<typeof LoadBrandGuidelinesOutputSchema>;

// In-memory brand profile cache
let loadedBrandProfile: BrandProfile | null = null;

/**
 * Get currently loaded brand profile
 */
export function getLoadedBrandProfile(): BrandProfile | null {
  return loadedBrandProfile;
}

/**
 * Clear loaded brand profile
 */
export function clearLoadedBrandProfile(): void {
  loadedBrandProfile = null;
}

/**
 * MCP Tool handler: load_brand_guidelines
 */
export async function loadBrandGuidelines(
  input: LoadBrandGuidelinesInput,
  actorId: string = 'claude'
): Promise<LoadBrandGuidelinesOutput> {
  const auditLogger = getAuditLogger();

  try {
    let brandData: unknown;

    // Load brand profile from one of three sources
    if (input.brandProfileJson) {
      // Parse from JSON string
      try {
        brandData = JSON.parse(input.brandProfileJson);
      } catch {
        throw new Error('Invalid JSON in brandProfileJson');
      }
    } else if (input.brandProfilePath) {
      // Load from file path
      const resolvedPath = path.resolve(input.brandProfilePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Brand profile file not found: ${resolvedPath}`);
      }
      const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
      brandData = JSON.parse(fileContent);
    } else if (input.brandName) {
      // Load from default profiles directory
      const defaultProfilesDir = path.resolve('./brand-profiles');
      const profilePath = path.join(defaultProfilesDir, `${input.brandName.toLowerCase()}.json`);

      if (!fs.existsSync(profilePath)) {
        throw new Error(`Default brand profile not found for: ${input.brandName}`);
      }
      const fileContent = fs.readFileSync(profilePath, 'utf-8');
      brandData = JSON.parse(fileContent);
    } else {
      throw new Error('Must provide brandProfilePath, brandProfileJson, or brandName');
    }

    // Validate brand profile
    const brandProfile = validateBrandProfile(brandData);

    // Store in memory
    loadedBrandProfile = brandProfile;

    // Extract disallowed patterns
    const disallowedPatterns = brandProfile.uiPatternConstraints
      .filter(c => !c.allowed)
      .map(c => c.pattern);

    // Log success
    await auditLogger.logToolInvocation({
      toolName: 'load_brand_guidelines',
      actorId,
      actorType: 'claude',
      outcome: 'success',
      message: `Loaded brand profile: ${brandProfile.brandName} (${brandProfile.version})`,
      input: {
        brandProfilePath: input.brandProfilePath,
        brandName: input.brandName,
        hasJsonInput: !!input.brandProfileJson,
      },
      brandProfileVersion: brandProfile.version,
    });

    return {
      success: true,
      brandProfile,
      brandName: brandProfile.brandName,
      version: brandProfile.version,
      designPrinciplesCount: brandProfile.designPrinciples.length,
      uiConstraintsCount: brandProfile.uiPatternConstraints.length,
      disallowedPatterns,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    await auditLogger.logToolInvocation({
      toolName: 'load_brand_guidelines',
      actorId,
      actorType: 'claude',
      outcome: 'failure',
      message: `Failed to load brand profile: ${errorMessage}`,
      input: {
        brandProfilePath: input.brandProfilePath,
        brandName: input.brandName,
        hasJsonInput: !!input.brandProfileJson,
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
export const loadBrandGuidelinesTool = {
  name: 'load_brand_guidelines',
  description: 'Load and validate brand profile for PRD governance. Must be called before parsing PRD content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      brandProfilePath: {
        type: 'string',
        description: 'Path to brand profile JSON file',
      },
      brandProfileJson: {
        type: 'string',
        description: 'Brand profile as JSON string',
      },
      brandName: {
        type: 'string',
        description: 'Brand name to load from default profiles',
      },
    },
  },
  handler: loadBrandGuidelines,
};
