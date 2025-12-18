/**
 * Version Controller
 * Manages PRD versioning with strict rules enforcement.
 */

import { PRD, compareVersions, incrementVersion, VersionHistoryEntry } from '../schemas/prd.schema.js';

export interface VersionChange {
  previousVersion: string;
  newVersion: string;
  changeType: 'major' | 'minor';
  reason: string;
}

export interface VersionValidation {
  valid: boolean;
  message?: string;
  suggestedVersion?: string;
}

/**
 * Determines if a change requires major or minor version increment
 */
export function determineVersionChangeType(
  existingPRD: PRD | null,
  newPRD: PRD
): 'major' | 'minor' {
  if (!existingPRD) {
    return 'minor'; // Initial version
  }

  // Major changes: structural changes to modules or features
  const existingModuleIds = new Set(existingPRD.modules.map(m => m.moduleId));
  const newModuleIds = new Set(newPRD.modules.map(m => m.moduleId));

  // Added or removed modules = major
  const modulesAdded = [...newModuleIds].filter(id => !existingModuleIds.has(id));
  const modulesRemoved = [...existingModuleIds].filter(id => !newModuleIds.has(id));

  if (modulesAdded.length > 0 || modulesRemoved.length > 0) {
    return 'major';
  }

  // Check for feature additions/removals
  const existingFeatureIds = new Set(
    existingPRD.modules.flatMap(m => m.features.map(f => f.featureId))
  );
  const newFeatureIds = new Set(
    newPRD.modules.flatMap(m => m.features.map(f => f.featureId))
  );

  const featuresAdded = [...newFeatureIds].filter(id => !existingFeatureIds.has(id));
  const featuresRemoved = [...existingFeatureIds].filter(id => !newFeatureIds.has(id));

  if (featuresAdded.length > 0 || featuresRemoved.length > 0) {
    return 'major';
  }

  // Check for scope changes
  const existingScopeItems = new Set(existingPRD.inScope.map(s => s.item));
  const newScopeItems = new Set(newPRD.inScope.map(s => s.item));

  const scopeAdded = [...newScopeItems].filter(item => !existingScopeItems.has(item));
  const scopeRemoved = [...existingScopeItems].filter(item => !newScopeItems.has(item));

  if (scopeAdded.length > 0 || scopeRemoved.length > 0) {
    return 'major';
  }

  // All other changes are minor
  return 'minor';
}

/**
 * Validates a proposed version change
 */
export function validateVersionChange(
  currentVersion: string | null,
  proposedVersion: string
): VersionValidation {
  // Validate format
  if (!/^v\d+\.\d+$/.test(proposedVersion)) {
    return {
      valid: false,
      message: `Invalid version format: ${proposedVersion}. Expected format: vX.Y`,
    };
  }

  // If no current version, proposed must be v1.0 or v0.1
  if (!currentVersion) {
    const [major, minor] = proposedVersion.replace('v', '').split('.').map(Number);
    if ((major === 1 && minor === 0) || (major === 0 && minor === 1)) {
      return { valid: true };
    }
    return {
      valid: false,
      message: 'Initial version must be v1.0 or v0.1',
      suggestedVersion: 'v1.0',
    };
  }

  // Check no downgrade
  if (compareVersions(proposedVersion, currentVersion) <= 0) {
    const suggested = incrementVersion(currentVersion, 'minor');
    return {
      valid: false,
      message: `Version downgrade not allowed. Current: ${currentVersion}, Proposed: ${proposedVersion}`,
      suggestedVersion: suggested,
    };
  }

  // Check increment is valid (can't skip versions)
  const [currentMajor, currentMinor] = currentVersion.replace('v', '').split('.').map(Number);
  const [proposedMajor, proposedMinor] = proposedVersion.replace('v', '').split('.').map(Number);

  // Major version can increment by 1, minor resets to 0
  if (proposedMajor === currentMajor + 1 && proposedMinor === 0) {
    return { valid: true };
  }

  // Minor version can increment by 1, major stays same
  if (proposedMajor === currentMajor && proposedMinor === currentMinor + 1) {
    return { valid: true };
  }

  // Otherwise, invalid increment
  return {
    valid: false,
    message: `Invalid version increment from ${currentVersion} to ${proposedVersion}. Versions must increment sequentially.`,
    suggestedVersion: incrementVersion(currentVersion, 'minor'),
  };
}

/**
 * Proposes the next version based on changes
 */
export function proposeNextVersion(
  existingPRD: PRD | null,
  newPRD: PRD
): VersionChange {
  const changeType = determineVersionChangeType(existingPRD, newPRD);
  const currentVersion = existingPRD?.version || null;
  const previousVersion = currentVersion || 'v0.0';

  let newVersion: string;
  let reason: string;

  if (!currentVersion) {
    newVersion = 'v1.0';
    reason = 'Initial PRD version';
  } else if (changeType === 'major') {
    newVersion = incrementVersion(currentVersion, 'major');
    reason = 'Structural changes detected (modules, features, or scope changes)';
  } else {
    newVersion = incrementVersion(currentVersion, 'minor');
    reason = 'Content updates without structural changes';
  }

  return {
    previousVersion,
    newVersion,
    changeType,
    reason,
  };
}

/**
 * Creates a version history entry
 */
export function createVersionHistoryEntry(
  version: string,
  changedBy: string,
  summary: string,
  details?: string[]
): VersionHistoryEntry {
  return {
    version,
    date: new Date().toISOString(),
    changedBy,
    summary,
    details,
  };
}

/**
 * Detects what changed between two PRD versions
 */
export function detectChanges(
  existingPRD: PRD | null,
  newPRD: PRD
): string[] {
  const changes: string[] = [];

  if (!existingPRD) {
    changes.push('Initial PRD creation');
    return changes;
  }

  // Check title
  if (existingPRD.title !== newPRD.title) {
    changes.push(`Title changed from "${existingPRD.title}" to "${newPRD.title}"`);
  }

  // Check objective
  if (existingPRD.objective.statement !== newPRD.objective.statement) {
    changes.push('Objective statement updated');
  }

  // Check modules
  const existingModuleIds = new Set(existingPRD.modules.map(m => m.moduleId));
  const newModuleIds = new Set(newPRD.modules.map(m => m.moduleId));

  for (const moduleId of newModuleIds) {
    if (!existingModuleIds.has(moduleId)) {
      const module = newPRD.modules.find(m => m.moduleId === moduleId);
      changes.push(`Added module: ${module?.moduleName || moduleId}`);
    }
  }

  for (const moduleId of existingModuleIds) {
    if (!newModuleIds.has(moduleId)) {
      const module = existingPRD.modules.find(m => m.moduleId === moduleId);
      changes.push(`Removed module: ${module?.moduleName || moduleId}`);
    }
  }

  // Check features
  const existingFeatures = new Map(
    existingPRD.modules.flatMap(m =>
      m.features.map(f => [f.featureId, f])
    )
  );
  const newFeatures = new Map(
    newPRD.modules.flatMap(m =>
      m.features.map(f => [f.featureId, f])
    )
  );

  for (const [featureId, feature] of newFeatures) {
    if (!existingFeatures.has(featureId)) {
      changes.push(`Added feature: ${feature.featureName}`);
    } else {
      const existingFeature = existingFeatures.get(featureId);
      if (existingFeature && existingFeature.description !== feature.description) {
        changes.push(`Updated feature: ${feature.featureName}`);
      }
    }
  }

  for (const [featureId, feature] of existingFeatures) {
    if (!newFeatures.has(featureId)) {
      changes.push(`Removed feature: ${feature.featureName}`);
    }
  }

  // Check scope changes
  const existingScopeItems = new Set(existingPRD.inScope.map(s => s.item));
  const newScopeItems = new Set(newPRD.inScope.map(s => s.item));

  for (const item of newScopeItems) {
    if (!existingScopeItems.has(item)) {
      changes.push(`Added to scope: ${item}`);
    }
  }

  for (const item of existingScopeItems) {
    if (!newScopeItems.has(item)) {
      changes.push(`Removed from scope: ${item}`);
    }
  }

  if (changes.length === 0) {
    changes.push('Minor content updates');
  }

  return changes;
}

/**
 * Gets version comparison details
 */
export function getVersionComparisonSummary(
  v1: string,
  v2: string
): {
  comparison: 'equal' | 'upgrade' | 'downgrade';
  majorDiff: number;
  minorDiff: number;
} {
  const [major1, minor1] = v1.replace('v', '').split('.').map(Number);
  const [major2, minor2] = v2.replace('v', '').split('.').map(Number);

  const result = compareVersions(v2, v1);

  return {
    comparison: result === 0 ? 'equal' : result > 0 ? 'upgrade' : 'downgrade',
    majorDiff: major2 - major1,
    minorDiff: minor2 - minor1,
  };
}
