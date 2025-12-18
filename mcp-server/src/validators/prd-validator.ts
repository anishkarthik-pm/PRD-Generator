/**
 * PRD Validator
 * Validates PRD structure, completeness, and internal consistency.
 */

import { PRD, PRDInput, PRDSchema, compareVersions } from '../schemas/prd.schema.js';
import { z } from 'zod';

export interface PRDValidationResult {
  valid: boolean;
  errors: PRDValidationError[];
  warnings: PRDValidationWarning[];
  completenessScore: number;
}

export interface PRDValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface PRDValidationWarning {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

/**
 * Validate PRD structure against schema
 */
export function validatePRDStructure(data: unknown): {
  valid: boolean;
  prd?: PRD;
  errors?: z.ZodError;
} {
  try {
    const prd = PRDSchema.parse(data);
    return { valid: true, prd };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    throw error;
  }
}

/**
 * Comprehensive PRD validation
 */
export function validatePRD(prd: PRD): PRDValidationResult {
  const errors: PRDValidationError[] = [];
  const warnings: PRDValidationWarning[] = [];

  // Check version format and history
  validateVersioning(prd, errors, warnings);

  // Check internal references and dependencies
  validateDependencies(prd, errors, warnings);

  // Check completeness of features
  validateFeatureCompleteness(prd, errors, warnings);

  // Check for duplicate IDs
  validateUniqueIds(prd, errors);

  // Check success metrics are measurable
  validateSuccessMetrics(prd, warnings);

  // Check user flows have proper structure
  validateUserFlows(prd, errors, warnings);

  // Calculate completeness score
  const completenessScore = calculateCompletenessScore(prd);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    completenessScore,
  };
}

/**
 * Validate versioning rules
 */
function validateVersioning(
  prd: PRD,
  errors: PRDValidationError[],
  warnings: PRDValidationWarning[]
): void {
  // Check version history is in order
  const versions = prd.versionHistory.map(v => v.version);

  for (let i = 1; i < versions.length; i++) {
    if (compareVersions(versions[i], versions[i - 1]) <= 0) {
      errors.push({
        code: 'VERSION_ORDER',
        message: `Version history is not in ascending order: ${versions[i - 1]} -> ${versions[i]}`,
        path: `versionHistory[${i}]`,
      });
    }
  }

  // Check current version matches latest in history
  const latestHistoryVersion = versions[versions.length - 1];
  if (latestHistoryVersion && prd.version !== latestHistoryVersion) {
    errors.push({
      code: 'VERSION_MISMATCH',
      message: `PRD version (${prd.version}) does not match latest history entry (${latestHistoryVersion})`,
    });
  }

  // Warn if no version history
  if (prd.versionHistory.length === 0) {
    warnings.push({
      code: 'NO_VERSION_HISTORY',
      message: 'PRD has no version history entries',
      suggestion: 'Add initial version history entry',
    });
  }
}

/**
 * Validate module and feature dependencies
 */
function validateDependencies(
  prd: PRD,
  errors: PRDValidationError[],
  warnings: PRDValidationWarning[]
): void {
  const moduleIds = new Set(prd.modules.map(m => m.moduleId));
  const featureIds = new Set(
    prd.modules.flatMap(m => m.features.map(f => f.featureId))
  );

  // Check module dependencies
  for (const module of prd.modules) {
    if (module.dependencies) {
      for (const dep of module.dependencies) {
        if (!moduleIds.has(dep) && !featureIds.has(dep)) {
          warnings.push({
            code: 'UNKNOWN_DEPENDENCY',
            message: `Module "${module.moduleName}" depends on unknown module/feature: ${dep}`,
            path: `modules.${module.moduleId}.dependencies`,
          });
        }
      }
    }

    // Check feature dependencies
    for (const feature of module.features) {
      if (feature.dependencies) {
        for (const dep of feature.dependencies) {
          if (!featureIds.has(dep) && !moduleIds.has(dep)) {
            warnings.push({
              code: 'UNKNOWN_DEPENDENCY',
              message: `Feature "${feature.featureName}" depends on unknown feature/module: ${dep}`,
              path: `modules.${module.moduleId}.features.${feature.featureId}.dependencies`,
            });
          }

          // Check for circular dependencies (simplified check)
          if (dep === feature.featureId) {
            errors.push({
              code: 'CIRCULAR_DEPENDENCY',
              message: `Feature "${feature.featureName}" has circular dependency on itself`,
              path: `modules.${module.moduleId}.features.${feature.featureId}.dependencies`,
            });
          }
        }
      }
    }
  }
}

/**
 * Validate feature completeness
 */
function validateFeatureCompleteness(
  prd: PRD,
  errors: PRDValidationError[],
  warnings: PRDValidationWarning[]
): void {
  for (const module of prd.modules) {
    for (const feature of module.features) {
      const path = `modules.${module.moduleId}.features.${feature.featureId}`;

      // P0 features must have edge cases and success metrics
      if (feature.priority === 'P0') {
        if (!feature.edgeCases || feature.edgeCases.length === 0) {
          warnings.push({
            code: 'P0_MISSING_EDGE_CASES',
            message: `P0 feature "${feature.featureName}" has no edge cases defined`,
            path,
            suggestion: 'Add edge cases for critical features',
          });
        }

        if (!feature.successMetrics || feature.successMetrics.length === 0) {
          warnings.push({
            code: 'P0_MISSING_METRICS',
            message: `P0 feature "${feature.featureName}" has no success metrics`,
            path,
            suggestion: 'Add success metrics to measure feature success',
          });
        }
      }

      // All features must have at least one user flow
      if (feature.userFlows.length === 0) {
        errors.push({
          code: 'NO_USER_FLOWS',
          message: `Feature "${feature.featureName}" has no user flows`,
          path,
        });
      }

      // Check user flow steps are numbered correctly
      for (const flow of feature.userFlows) {
        const stepNumbers = flow.steps.map(s => s.stepNumber);
        const expectedNumbers = flow.steps.map((_, i) => i + 1);

        if (JSON.stringify(stepNumbers) !== JSON.stringify(expectedNumbers)) {
          errors.push({
            code: 'INVALID_STEP_NUMBERS',
            message: `Flow "${flow.flowName}" has non-sequential step numbers`,
            path: `${path}.flows.${flow.flowName}`,
          });
        }
      }
    }
  }
}

/**
 * Validate unique IDs
 */
function validateUniqueIds(prd: PRD, errors: PRDValidationError[]): void {
  const moduleIds = new Map<string, number>();
  const featureIds = new Map<string, number>();

  for (const module of prd.modules) {
    const existing = moduleIds.get(module.moduleId);
    if (existing !== undefined) {
      errors.push({
        code: 'DUPLICATE_MODULE_ID',
        message: `Duplicate module ID: ${module.moduleId}`,
      });
    }
    moduleIds.set(module.moduleId, (existing || 0) + 1);

    for (const feature of module.features) {
      const existingFeature = featureIds.get(feature.featureId);
      if (existingFeature !== undefined) {
        errors.push({
          code: 'DUPLICATE_FEATURE_ID',
          message: `Duplicate feature ID: ${feature.featureId}`,
        });
      }
      featureIds.set(feature.featureId, (existingFeature || 0) + 1);
    }
  }
}

/**
 * Validate success metrics are measurable
 */
function validateSuccessMetrics(prd: PRD, warnings: PRDValidationWarning[]): void {
  const vagueMeasurements = ['improve', 'better', 'more', 'less', 'good', 'bad'];

  const allMetrics = [
    ...(prd.globalSuccessMetrics || []),
    ...prd.modules.flatMap(m =>
      m.features.flatMap(f => f.successMetrics || [])
    ),
  ];

  for (const metric of allMetrics) {
    const targetLower = metric.target.toLowerCase();
    const methodLower = metric.measurementMethod.toLowerCase();

    for (const vague of vagueMeasurements) {
      if (targetLower.includes(vague) && !targetLower.match(/\d/)) {
        warnings.push({
          code: 'VAGUE_METRIC_TARGET',
          message: `Metric "${metric.metric}" has vague target: "${metric.target}"`,
          suggestion: 'Add specific, measurable targets with numbers',
        });
        break;
      }
    }

    // Check measurement method has substance
    if (methodLower.length < 20) {
      warnings.push({
        code: 'INSUFFICIENT_MEASUREMENT_METHOD',
        message: `Metric "${metric.metric}" has insufficient measurement method`,
        suggestion: 'Describe how the metric will be measured in detail',
      });
    }
  }
}

/**
 * Validate user flows structure
 */
function validateUserFlows(
  prd: PRD,
  errors: PRDValidationError[],
  warnings: PRDValidationWarning[]
): void {
  for (const module of prd.modules) {
    for (const feature of module.features) {
      for (const flow of feature.userFlows) {
        const path = `modules.${module.moduleId}.features.${feature.featureId}.flows.${flow.flowName}`;

        // Check flow has reasonable number of steps
        if (flow.steps.length > 15) {
          warnings.push({
            code: 'TOO_MANY_STEPS',
            message: `Flow "${flow.flowName}" has ${flow.steps.length} steps. Consider breaking into smaller flows.`,
            path,
            suggestion: 'Aim for 5-10 steps per flow for clarity',
          });
        }

        // Check each step has meaningful action and result
        for (const step of flow.steps) {
          if (step.action.length < 10) {
            warnings.push({
              code: 'TERSE_ACTION',
              message: `Step ${step.stepNumber} in "${flow.flowName}" has very short action`,
              path: `${path}.steps[${step.stepNumber}]`,
            });
          }

          if (step.expectedResult.length < 10) {
            warnings.push({
              code: 'TERSE_RESULT',
              message: `Step ${step.stepNumber} in "${flow.flowName}" has very short expected result`,
              path: `${path}.steps[${step.stepNumber}]`,
            });
          }
        }
      }
    }
  }
}

/**
 * Calculate completeness score (0-100)
 */
function calculateCompletenessScore(prd: PRD): number {
  let score = 0;
  const weights = {
    objective: 15,
    scope: 10,
    assumptions: 5,
    modules: 20,
    features: 20,
    userFlows: 15,
    edgeCases: 5,
    successMetrics: 5,
    versionHistory: 5,
  };

  // Objective
  if (prd.objective.statement && prd.objective.businessValue && prd.objective.targetUsers.length > 0) {
    score += weights.objective;
  } else if (prd.objective.statement) {
    score += weights.objective * 0.5;
  }

  // Scope
  if (prd.inScope.length > 0 && prd.outOfScope.length > 0) {
    score += weights.scope;
  } else if (prd.inScope.length > 0) {
    score += weights.scope * 0.5;
  }

  // Assumptions
  if (prd.assumptions.length > 0) {
    score += weights.assumptions;
  }

  // Modules
  if (prd.modules.length > 0) {
    score += weights.modules;
  }

  // Features
  const totalFeatures = prd.modules.reduce((sum, m) => sum + m.features.length, 0);
  if (totalFeatures > 0) {
    score += weights.features;
  }

  // User flows
  const totalFlows = prd.modules.reduce(
    (sum, m) => sum + m.features.reduce((fsum, f) => fsum + f.userFlows.length, 0),
    0
  );
  if (totalFlows > 0) {
    score += weights.userFlows;
  }

  // Edge cases
  const totalEdgeCases = prd.modules.reduce(
    (sum, m) => sum + m.features.reduce((fsum, f) => fsum + (f.edgeCases?.length || 0), 0),
    0
  );
  if (totalEdgeCases > 0) {
    score += weights.edgeCases;
  }

  // Success metrics
  const totalMetrics =
    (prd.globalSuccessMetrics?.length || 0) +
    prd.modules.reduce(
      (sum, m) => sum + m.features.reduce((fsum, f) => fsum + (f.successMetrics?.length || 0), 0),
      0
    );
  if (totalMetrics > 0) {
    score += weights.successMetrics;
  }

  // Version history
  if (prd.versionHistory.length > 0) {
    score += weights.versionHistory;
  }

  return Math.round(score);
}

/**
 * Check if PRD update is valid (no downgrades, etc.)
 */
export function validatePRDUpdate(
  existingPRD: PRD,
  updatedPRD: PRD
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check version increment
  if (compareVersions(updatedPRD.version, existingPRD.version) <= 0) {
    errors.push(
      `Version downgrade not allowed. Current: ${existingPRD.version}, Proposed: ${updatedPRD.version}`
    );
  }

  // Check PRD ID matches
  if (updatedPRD.prdId !== existingPRD.prdId) {
    errors.push('PRD ID cannot be changed during update');
  }

  // Check no removal of approved features without deprecation
  const existingApprovedFeatures = new Set(
    existingPRD.modules.flatMap(m =>
      m.features.filter(f => f.status === 'approved').map(f => f.featureId)
    )
  );

  const updatedFeatureIds = new Set(
    updatedPRD.modules.flatMap(m => m.features.map(f => f.featureId))
  );

  for (const approvedId of existingApprovedFeatures) {
    if (!updatedFeatureIds.has(approvedId)) {
      errors.push(
        `Approved feature "${approvedId}" cannot be removed without deprecation process`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
