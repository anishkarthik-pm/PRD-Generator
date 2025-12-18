/**
 * Brand Validator
 * Validates PRD content against brand guidelines and constraints.
 */

import { BrandProfile, getDisallowedPatterns, isPatternAllowed } from '../schemas/brand-profile.schema.js';
import { PRD, Feature, UserFlow } from '../schemas/prd.schema.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  severity: 'warning';
  suggestion?: string;
}

/**
 * Validates a PRD against brand guidelines
 */
export function validatePRDAgainstBrand(prd: PRD, brand: BrandProfile): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check brand context matches
  if (prd.brandContext.brandName !== brand.brandName) {
    errors.push({
      code: 'BRAND_MISMATCH',
      message: `PRD brand context (${prd.brandContext.brandName}) does not match loaded brand profile (${brand.brandName})`,
      severity: 'error',
    });
  }

  // Validate UI constraints referenced in PRD
  const disallowedPatterns = getDisallowedPatterns(brand);
  const disallowedPatternNames = new Set(disallowedPatterns.map(p => p.pattern.toLowerCase()));

  // Check all features and flows for disallowed patterns
  for (const module of prd.modules) {
    for (const feature of module.features) {
      // Check feature description for disallowed patterns
      checkTextForPatterns(
        feature.description,
        disallowedPatternNames,
        `modules.${module.moduleId}.features.${feature.featureId}.description`,
        errors,
        brand
      );

      // Check user flows
      for (const flow of feature.userFlows) {
        checkFlowForPatterns(flow, disallowedPatternNames,
          `modules.${module.moduleId}.features.${feature.featureId}.flows.${flow.flowName}`,
          errors, warnings, brand);
      }
    }
  }

  // Check design principles alignment
  const criticalPrinciples = brand.designPrinciples.filter(p => p.priority === 'critical');
  for (const principle of criticalPrinciples) {
    const alignment = checkPrincipleAlignment(prd, principle);
    if (!alignment.aligned) {
      warnings.push({
        code: 'PRINCIPLE_ALIGNMENT',
        message: `PRD may not fully align with critical design principle: "${principle.name}"`,
        suggestion: alignment.suggestion,
        severity: 'warning',
      });
    }
  }

  // Validate component constraints if defined
  if (brand.componentConstraints) {
    validateComponentConstraints(prd, brand.componentConstraints, errors, warnings);
  }

  // Check mobile-first constraint
  if (brand.platformConstraints?.mobileFirst) {
    checkMobileFirstCompliance(prd, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check text for mentions of disallowed UI patterns
 */
function checkTextForPatterns(
  text: string,
  disallowedPatterns: Set<string>,
  path: string,
  errors: ValidationError[],
  brand: BrandProfile
): void {
  const lowerText = text.toLowerCase();

  for (const pattern of disallowedPatterns) {
    if (lowerText.includes(pattern)) {
      const result = isPatternAllowed(brand, pattern);
      errors.push({
        code: 'DISALLOWED_PATTERN',
        message: `Disallowed UI pattern "${pattern}" found. Reason: ${result.reason}`,
        path,
        severity: 'error',
      });
    }
  }
}

/**
 * Check user flow for pattern violations
 */
function checkFlowForPatterns(
  flow: UserFlow,
  disallowedPatterns: Set<string>,
  basePath: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  brand: BrandProfile
): void {
  // Check flow description
  checkTextForPatterns(flow.description, disallowedPatterns, `${basePath}.description`, errors, brand);

  // Check each step
  for (const step of flow.steps) {
    const stepPath = `${basePath}.steps[${step.stepNumber}]`;

    checkTextForPatterns(step.action, disallowedPatterns, `${stepPath}.action`, errors, brand);
    checkTextForPatterns(step.expectedResult, disallowedPatterns, `${stepPath}.expectedResult`, errors, brand);

    if (step.uiElement) {
      checkTextForPatterns(step.uiElement, disallowedPatterns, `${stepPath}.uiElement`, errors, brand);
    }

    // Check for multiple CTAs per screen (common anti-pattern)
    if (step.action.toLowerCase().includes('click') || step.action.toLowerCase().includes('tap')) {
      const ctaMatches = step.action.match(/button|cta|submit|action/gi) || [];
      if (ctaMatches.length > 1) {
        warnings.push({
          code: 'MULTIPLE_CTAS',
          message: 'Flow step may contain multiple CTAs. Consider simplifying.',
          path: stepPath,
          severity: 'warning',
          suggestion: 'Ensure only one primary CTA per screen for clarity.',
        });
      }
    }
  }
}

/**
 * Check alignment with design principle
 */
function checkPrincipleAlignment(
  prd: PRD,
  principle: { name: string; description: string }
): { aligned: boolean; suggestion?: string } {
  // This is a heuristic check - in production, this would be more sophisticated
  const principleKeywords = principle.description.toLowerCase().split(/\s+/);
  const prdText = JSON.stringify(prd).toLowerCase();

  const matchCount = principleKeywords.filter(kw =>
    kw.length > 4 && prdText.includes(kw)
  ).length;

  const alignmentRatio = matchCount / principleKeywords.length;

  if (alignmentRatio < 0.2) {
    return {
      aligned: false,
      suggestion: `Consider how "${principle.name}" applies to your PRD: ${principle.description}`,
    };
  }

  return { aligned: true };
}

/**
 * Validate component constraints
 */
function validateComponentConstraints(
  prd: PRD,
  constraints: Array<{
    component: string;
    maxPerScreen?: number;
    requiredContext?: string[];
    forbiddenWith?: string[];
  }>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const prdText = JSON.stringify(prd).toLowerCase();

  for (const constraint of constraints) {
    const componentLower = constraint.component.toLowerCase();
    const mentions = (prdText.match(new RegExp(componentLower, 'g')) || []).length;

    // Check max per screen (approximation)
    if (constraint.maxPerScreen !== undefined && mentions > constraint.maxPerScreen * prd.modules.length) {
      warnings.push({
        code: 'COMPONENT_OVERUSE',
        message: `Component "${constraint.component}" may be overused (found ${mentions} mentions, max ${constraint.maxPerScreen} per screen recommended)`,
        severity: 'warning',
      });
    }

    // Check forbidden combinations
    if (constraint.forbiddenWith && mentions > 0) {
      for (const forbidden of constraint.forbiddenWith) {
        if (prdText.includes(forbidden.toLowerCase())) {
          errors.push({
            code: 'FORBIDDEN_COMBINATION',
            message: `Component "${constraint.component}" should not be used with "${forbidden}"`,
            severity: 'error',
          });
        }
      }
    }
  }
}

/**
 * Check mobile-first compliance
 */
function checkMobileFirstCompliance(prd: PRD, warnings: ValidationWarning[]): void {
  const desktopOnlyPatterns = ['hover', 'right-click', 'drag and drop', 'multi-select'];
  const prdText = JSON.stringify(prd).toLowerCase();

  for (const pattern of desktopOnlyPatterns) {
    if (prdText.includes(pattern)) {
      warnings.push({
        code: 'MOBILE_FIRST_CONCERN',
        message: `Pattern "${pattern}" may not work well on mobile devices`,
        severity: 'warning',
        suggestion: 'Ensure mobile alternative exists for this interaction',
      });
    }
  }
}

/**
 * Validate brand profile version compatibility
 */
export function validateBrandVersionCompatibility(
  prdBrandVersion: string,
  loadedBrandVersion: string
): { compatible: boolean; message?: string } {
  const [prdMajor] = prdBrandVersion.replace('v', '').split('.').map(Number);
  const [loadedMajor] = loadedBrandVersion.replace('v', '').split('.').map(Number);

  if (prdMajor !== loadedMajor) {
    return {
      compatible: false,
      message: `PRD was created with brand guidelines ${prdBrandVersion}, but loaded version is ${loadedBrandVersion}. Major version mismatch may cause validation issues.`,
    };
  }

  return { compatible: true };
}

/**
 * Quick validation of a single feature against brand
 */
export function validateFeatureAgainstBrand(
  feature: Feature,
  brand: BrandProfile
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const disallowedPatterns = getDisallowedPatterns(brand);
  const disallowedPatternNames = new Set(disallowedPatterns.map(p => p.pattern.toLowerCase()));

  checkTextForPatterns(feature.description, disallowedPatternNames, 'feature.description', errors, brand);

  for (const flow of feature.userFlows) {
    checkFlowForPatterns(flow, disallowedPatternNames, `feature.flows.${flow.flowName}`, errors, warnings, brand);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
