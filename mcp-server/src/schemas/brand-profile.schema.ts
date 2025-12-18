/**
 * Brand Profile Schema
 * Defines the structure for brand governance rules that constrain PRD generation.
 */

import { z } from 'zod';

// Color token schema
export const ColorTokenSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  usage: z.enum(['primary', 'secondary', 'accent', 'background', 'text', 'error', 'warning', 'success']),
  contrastRatio: z.number().min(1).optional(),
});

// Typography token schema
export const TypographyTokenSchema = z.object({
  name: z.string().min(1),
  fontFamily: z.string().min(1),
  weights: z.array(z.number().int().min(100).max(900)),
  usage: z.enum(['heading', 'body', 'caption', 'button', 'mono']),
  fallback: z.string().optional(),
});

// UI pattern constraint schema
export const UIPatternConstraintSchema = z.object({
  pattern: z.string().min(1),
  allowed: z.boolean(),
  reason: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
});

// Design principle schema
export const DesignPrincipleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  examples: z.array(z.string()).optional(),
});

// Reference product schema (non-binding)
export const ReferenceProductSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  relevantPatterns: z.array(z.string()),
  notes: z.string().optional(),
});

// Spacing token schema
export const SpacingTokenSchema = z.object({
  name: z.string().min(1),
  value: z.string().regex(/^\d+(\.\d+)?(px|rem|em)$/),
  usage: z.string(),
});

// Component constraint schema
export const ComponentConstraintSchema = z.object({
  component: z.string().min(1),
  maxPerScreen: z.number().int().min(0).optional(),
  requiredContext: z.array(z.string()).optional(),
  forbiddenWith: z.array(z.string()).optional(),
});

// Full Brand Profile schema
export const BrandProfileSchema = z.object({
  // Metadata
  brandName: z.string().min(1),
  version: z.string().regex(/^v\d+\.\d+$/),
  lastUpdated: z.string().datetime(),
  owner: z.string().min(1),

  // Design principles
  designPrinciples: z.array(DesignPrincipleSchema).min(1),

  // Visual tokens
  colorTokens: z.array(ColorTokenSchema).min(1),
  typographyTokens: z.array(TypographyTokenSchema).min(1),
  spacingTokens: z.array(SpacingTokenSchema).optional(),

  // UI constraints
  uiPatternConstraints: z.array(UIPatternConstraintSchema),
  componentConstraints: z.array(ComponentConstraintSchema).optional(),

  // Reference products (non-binding)
  referenceProducts: z.array(ReferenceProductSchema).optional(),

  // Platform constraints
  platformConstraints: z.object({
    mobileFirst: z.boolean().default(true),
    minTouchTargetSize: z.string().default('44px'),
    maxContentWidth: z.string().optional(),
    supportedBreakpoints: z.array(z.string()).optional(),
  }).optional(),

  // Accessibility requirements
  accessibilityRequirements: z.object({
    minContrastRatio: z.number().min(1).default(4.5),
    requireAltText: z.boolean().default(true),
    requireAriaLabels: z.boolean().default(true),
    focusIndicatorRequired: z.boolean().default(true),
  }).optional(),
});

// Type exports
export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type TypographyToken = z.infer<typeof TypographyTokenSchema>;
export type UIPatternConstraint = z.infer<typeof UIPatternConstraintSchema>;
export type DesignPrinciple = z.infer<typeof DesignPrincipleSchema>;
export type ReferenceProduct = z.infer<typeof ReferenceProductSchema>;
export type SpacingToken = z.infer<typeof SpacingTokenSchema>;
export type ComponentConstraint = z.infer<typeof ComponentConstraintSchema>;
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// Validation helper
export function validateBrandProfile(data: unknown): BrandProfile {
  return BrandProfileSchema.parse(data);
}

// Check if a UI pattern is allowed
export function isPatternAllowed(profile: BrandProfile, patternName: string): {
  allowed: boolean;
  reason?: string;
  alternatives?: string[];
} {
  const constraint = profile.uiPatternConstraints.find(
    c => c.pattern.toLowerCase() === patternName.toLowerCase()
  );

  if (!constraint) {
    // Pattern not explicitly constrained, assume allowed
    return { allowed: true };
  }

  return {
    allowed: constraint.allowed,
    reason: constraint.reason,
    alternatives: constraint.alternatives,
  };
}

// Get primary color token
export function getPrimaryColor(profile: BrandProfile): ColorToken | undefined {
  return profile.colorTokens.find(c => c.usage === 'primary');
}

// Get all disallowed patterns
export function getDisallowedPatterns(profile: BrandProfile): UIPatternConstraint[] {
  return profile.uiPatternConstraints.filter(c => !c.allowed);
}
