/**
 * PRD (Product Requirements Document) Schema
 * This is the SINGLE SOURCE OF TRUTH for all PRD outputs.
 */

import { z } from 'zod';

// Success metric schema
export const SuccessMetricSchema = z.object({
  metric: z.string().min(1),
  target: z.string().min(1),
  measurementMethod: z.string().min(1),
  owner: z.string().optional(),
});

// Edge case schema
export const EdgeCaseSchema = z.object({
  scenario: z.string().min(1),
  expectedBehavior: z.string().min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
});

// User flow step schema
export const UserFlowStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  action: z.string().min(1),
  expectedResult: z.string().min(1),
  uiElement: z.string().optional(),
  notes: z.string().optional(),
});

// User flow schema
export const UserFlowSchema = z.object({
  flowName: z.string().min(1),
  description: z.string().min(1),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(UserFlowStepSchema).min(1),
  postconditions: z.array(z.string()).optional(),
  alternativePaths: z.array(z.string()).optional(),
});

// Feature schema
export const FeatureSchema = z.object({
  featureId: z.string().min(1),
  featureName: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  userFlows: z.array(UserFlowSchema).min(1),
  edgeCases: z.array(EdgeCaseSchema).optional(),
  successMetrics: z.array(SuccessMetricSchema).optional(),
  dependencies: z.array(z.string()).optional(),
  owner: z.string().optional(),
  status: z.enum(['draft', 'in-review', 'approved', 'in-development', 'complete']).default('draft'),
});

// Module schema
export const ModuleSchema = z.object({
  moduleId: z.string().min(1),
  moduleName: z.string().min(1),
  description: z.string().min(1),
  features: z.array(FeatureSchema).min(1),
  dependencies: z.array(z.string()).optional(),
});

// Brand context schema (embedded in PRD)
export const BrandContextSchema = z.object({
  brandName: z.string().min(1),
  guidelinesVersion: z.string().regex(/^v\d+\.\d+$/),
  uiConstraints: z.array(z.string()),
  referenceFlows: z.array(z.string()).optional(),
  colorOverrides: z.record(z.string(), z.string()).optional(),
});

// Assumption schema
export const AssumptionSchema = z.object({
  assumption: z.string().min(1),
  risk: z.enum(['high', 'medium', 'low']),
  mitigation: z.string().optional(),
});

// Scope item schema
export const ScopeItemSchema = z.object({
  item: z.string().min(1),
  rationale: z.string().optional(),
});

// Version history entry
export const VersionHistoryEntrySchema = z.object({
  version: z.string().regex(/^v\d+\.\d+$/),
  date: z.string().datetime(),
  changedBy: z.string().min(1),
  summary: z.string().min(1),
  details: z.array(z.string()).optional(),
});

// Full PRD schema
export const PRDSchema = z.object({
  // Metadata
  prdId: z.string().min(1),
  title: z.string().min(1),
  version: z.string().regex(/^v\d+\.\d+$/),
  status: z.enum(['draft', 'in-review', 'approved', 'deprecated']).default('draft'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  owner: z.string().min(1),
  reviewers: z.array(z.string()).optional(),

  // Objective
  objective: z.object({
    statement: z.string().min(1),
    businessValue: z.string().min(1),
    targetUsers: z.array(z.string()).min(1),
    keyResults: z.array(z.string()).optional(),
  }),

  // Scope
  inScope: z.array(ScopeItemSchema).min(1),
  outOfScope: z.array(ScopeItemSchema),

  // Assumptions
  assumptions: z.array(AssumptionSchema),

  // Brand context
  brandContext: BrandContextSchema,

  // Modules (main content)
  modules: z.array(ModuleSchema).min(1),

  // Version history
  versionHistory: z.array(VersionHistoryEntrySchema),

  // Global success metrics
  globalSuccessMetrics: z.array(SuccessMetricSchema).optional(),

  // Technical notes
  technicalNotes: z.object({
    integrations: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
    securityConsiderations: z.array(z.string()).optional(),
    performanceRequirements: z.array(z.string()).optional(),
  }).optional(),
});

// Type exports
export type SuccessMetric = z.infer<typeof SuccessMetricSchema>;
export type EdgeCase = z.infer<typeof EdgeCaseSchema>;
export type UserFlowStep = z.infer<typeof UserFlowStepSchema>;
export type UserFlow = z.infer<typeof UserFlowSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type BrandContext = z.infer<typeof BrandContextSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type ScopeItem = z.infer<typeof ScopeItemSchema>;
export type VersionHistoryEntry = z.infer<typeof VersionHistoryEntrySchema>;
export type PRD = z.infer<typeof PRDSchema>;

// Validation helper
export function validatePRD(data: unknown): PRD {
  return PRDSchema.parse(data);
}

// Partial PRD for updates
export const PartialPRDSchema = PRDSchema.partial().required({
  prdId: true,
  version: true,
});

export type PartialPRD = z.infer<typeof PartialPRDSchema>;

// PRD input schema (for parsing raw content)
export const PRDInputSchema = z.object({
  title: z.string().min(1),
  owner: z.string().min(1),
  objective: z.string().min(1),
  businessValue: z.string().min(1),
  targetUsers: z.array(z.string()).min(1),
  inScope: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()),
  assumptions: z.array(z.string()),
  modules: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    features: z.array(z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']),
      flows: z.array(z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        steps: z.array(z.string()).min(1),
      })),
      edgeCases: z.array(z.string()).optional(),
      successMetrics: z.array(z.string()).optional(),
    })),
  })),
});

export type PRDInput = z.infer<typeof PRDInputSchema>;

// Helper to generate PRD ID
export function generatePRDId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const timestamp = Date.now().toString(36);
  return `prd-${slug}-${timestamp}`;
}

// Helper to compare versions
export function compareVersions(v1: string, v2: string): number {
  const [major1, minor1] = v1.replace('v', '').split('.').map(Number);
  const [major2, minor2] = v2.replace('v', '').split('.').map(Number);

  if (major1 !== major2) return major1 - major2;
  return minor1 - minor2;
}

// Helper to increment version
export function incrementVersion(current: string, type: 'major' | 'minor'): string {
  const [major, minor] = current.replace('v', '').split('.').map(Number);

  if (type === 'major') {
    return `v${major + 1}.0`;
  }
  return `v${major}.${minor + 1}`;
}
