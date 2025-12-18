/**
 * PRD Automation Orchestrator
 * Defines the execution flow for PRD processing.
 */

import { PRD, PRDInput } from '../mcp-server/src/schemas/prd.schema.js';
import { BrandProfile } from '../mcp-server/src/schemas/brand-profile.schema.js';

/**
 * Orchestration State Machine
 * Tracks the current state of PRD processing
 */
export type OrchestrationState =
  | 'initial'
  | 'brand_loaded'
  | 'prd_parsed'
  | 'prd_validated'
  | 'review_artifacts_generated'
  | 'pending_approval'
  | 'approved'
  | 'google_doc_updated'
  | 'sheets_synced'
  | 'change_log_appended'
  | 'wireframes_generated'
  | 'audit_logged'
  | 'completed'
  | 'rejected'
  | 'error';

export interface OrchestrationContext {
  state: OrchestrationState;
  brandProfile?: BrandProfile;
  prdInput?: PRDInput;
  structuredPRD?: PRD;
  validationResult?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    completenessScore: number;
  };
  proposedVersion?: string;
  approvalGranted?: boolean;
  googleDocId?: string;
  googleDocUrl?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  wireframeDirectory?: string;
  wireframeCount?: number;
  error?: string;
  auditCorrelationId?: string;
}

/**
 * Orchestration Flow Definition
 * Defines the required execution order:
 *
 * 1. Load brand guidelines
 * 2. Parse PRD into structured JSON
 * 3. Validate PRD against brand rules
 * 4. Generate review artifacts
 * 5. Propose version increment
 * 6. Request explicit user approval
 * 7. On approval:
 *    - Update Google Docs PRD
 *    - Sync PRD Master Sheet
 *    - Append Change Log
 *    - Generate HTML wireframes
 *    - Log audit event
 */
export const ORCHESTRATION_FLOW = {
  steps: [
    {
      name: 'load_brand_guidelines',
      description: 'Load and validate brand profile',
      required: true,
      transitionTo: 'brand_loaded',
    },
    {
      name: 'parse_prd_content',
      description: 'Parse raw PRD into structured JSON',
      required: true,
      transitionTo: 'prd_parsed',
      requiresPreviousState: 'brand_loaded',
    },
    {
      name: 'validate_prd',
      description: 'Validate PRD against brand rules',
      required: true,
      transitionTo: 'prd_validated',
      requiresPreviousState: 'prd_parsed',
    },
    {
      name: 'generate_review_artifacts',
      description: 'Generate review artifacts (structured PRD, table preview, wireframe preview)',
      required: true,
      transitionTo: 'review_artifacts_generated',
      requiresPreviousState: 'prd_validated',
    },
    {
      name: 'propose_version',
      description: 'Propose version increment based on changes',
      required: true,
      transitionTo: 'pending_approval',
      requiresPreviousState: 'review_artifacts_generated',
    },
    {
      name: 'request_approval',
      description: 'Request explicit user approval before writes',
      required: true,
      transitionTo: 'approved',
      requiresPreviousState: 'pending_approval',
      blocksOnRejection: true,
    },
    {
      name: 'create_or_update_google_doc',
      description: 'Write PRD to Google Docs',
      required: true,
      transitionTo: 'google_doc_updated',
      requiresPreviousState: 'approved',
      requiresApproval: true,
    },
    {
      name: 'sync_prd_master_sheet',
      description: 'Sync structured data to Google Sheets',
      required: true,
      transitionTo: 'sheets_synced',
      requiresPreviousState: 'google_doc_updated',
      requiresApproval: true,
    },
    {
      name: 'append_change_log',
      description: 'Append entry to change log',
      required: true,
      transitionTo: 'change_log_appended',
      requiresPreviousState: 'sheets_synced',
      requiresApproval: true,
    },
    {
      name: 'generate_html_wireframes',
      description: 'Generate low-fidelity HTML wireframes',
      required: true,
      transitionTo: 'wireframes_generated',
      requiresPreviousState: 'change_log_appended',
      requiresApproval: true,
    },
    {
      name: 'log_audit_event',
      description: 'Log final audit event',
      required: true,
      transitionTo: 'completed',
      requiresPreviousState: 'wireframes_generated',
    },
  ],
} as const;

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentState: OrchestrationState,
  targetState: OrchestrationState
): boolean {
  const stateOrder: OrchestrationState[] = [
    'initial',
    'brand_loaded',
    'prd_parsed',
    'prd_validated',
    'review_artifacts_generated',
    'pending_approval',
    'approved',
    'google_doc_updated',
    'sheets_synced',
    'change_log_appended',
    'wireframes_generated',
    'audit_logged',
    'completed',
  ];

  const currentIndex = stateOrder.indexOf(currentState);
  const targetIndex = stateOrder.indexOf(targetState);

  // Can always transition to error or rejected
  if (targetState === 'error' || targetState === 'rejected') {
    return true;
  }

  // Must follow sequential order
  return targetIndex === currentIndex + 1;
}

/**
 * Get the next step based on current state
 */
export function getNextStep(
  currentState: OrchestrationState
): typeof ORCHESTRATION_FLOW.steps[number] | null {
  const step = ORCHESTRATION_FLOW.steps.find(
    s => s.requiresPreviousState === currentState || (currentState === 'initial' && s.name === 'load_brand_guidelines')
  );
  return step || null;
}

/**
 * Generate approval request message
 */
export function generateApprovalRequest(context: OrchestrationContext): string {
  if (!context.structuredPRD) {
    return 'No PRD available for approval.';
  }

  const prd = context.structuredPRD;
  const validation = context.validationResult;

  let message = `
## PRD Review - Approval Required

### PRD Summary
- **Title:** ${prd.title}
- **Version:** ${context.proposedVersion || prd.version}
- **Owner:** ${prd.owner}
- **Modules:** ${prd.modules.length}
- **Features:** ${prd.modules.reduce((sum, m) => sum + m.features.length, 0)}

### Objective
${prd.objective.statement}

### Brand Context
- **Brand:** ${prd.brandContext.brandName}
- **Guidelines Version:** ${prd.brandContext.guidelinesVersion}

### Validation Results
- **Structure Valid:** ${validation?.valid ? 'Yes' : 'No'}
- **Completeness Score:** ${validation?.completenessScore || 0}%
`;

  if (validation?.errors && validation.errors.length > 0) {
    message += `
### Errors (${validation.errors.length})
${validation.errors.map(e => `- ${e}`).join('\n')}
`;
  }

  if (validation?.warnings && validation.warnings.length > 0) {
    message += `
### Warnings (${validation.warnings.length})
${validation.warnings.map(w => `- ${w}`).join('\n')}
`;
  }

  message += `
### Actions to be Performed (Requires Approval)
1. Create/Update Google Docs PRD
2. Sync PRD Master Sheet
3. Append Change Log Entry
4. Generate HTML Wireframes
5. Log Audit Event

**Do you approve these changes? (yes/no)**
`;

  return message;
}

/**
 * Generate PRD table preview for review
 */
export function generatePRDTablePreview(prd: PRD): string {
  let table = `
| Module | Feature | Priority | Status | Flows |
|--------|---------|----------|--------|-------|
`;

  for (const module of prd.modules) {
    for (const feature of module.features) {
      table += `| ${module.moduleName} | ${feature.featureName} | ${feature.priority} | ${feature.status} | ${feature.userFlows.length} |\n`;
    }
  }

  return table;
}

/**
 * Calculate change summary for version update
 */
export function calculateChangeSummary(
  existingPRD: PRD | null,
  newPRD: PRD
): string {
  if (!existingPRD) {
    return `Initial PRD creation: ${newPRD.title} with ${newPRD.modules.length} modules and ${newPRD.modules.reduce((sum, m) => sum + m.features.length, 0)} features`;
  }

  const changes: string[] = [];

  // Check module changes
  const existingModuleIds = new Set(existingPRD.modules.map(m => m.moduleId));
  const newModuleIds = new Set(newPRD.modules.map(m => m.moduleId));

  const addedModules = [...newModuleIds].filter(id => !existingModuleIds.has(id));
  const removedModules = [...existingModuleIds].filter(id => !newModuleIds.has(id));

  if (addedModules.length > 0) {
    changes.push(`Added ${addedModules.length} module(s)`);
  }
  if (removedModules.length > 0) {
    changes.push(`Removed ${removedModules.length} module(s)`);
  }

  // Check feature changes
  const existingFeatureIds = new Set(
    existingPRD.modules.flatMap(m => m.features.map(f => f.featureId))
  );
  const newFeatureIds = new Set(
    newPRD.modules.flatMap(m => m.features.map(f => f.featureId))
  );

  const addedFeatures = [...newFeatureIds].filter(id => !existingFeatureIds.has(id));
  const removedFeatures = [...existingFeatureIds].filter(id => !newFeatureIds.has(id));

  if (addedFeatures.length > 0) {
    changes.push(`Added ${addedFeatures.length} feature(s)`);
  }
  if (removedFeatures.length > 0) {
    changes.push(`Removed ${removedFeatures.length} feature(s)`);
  }

  if (changes.length === 0) {
    changes.push('Content updates');
  }

  return changes.join('; ');
}

/**
 * Create initial orchestration context
 */
export function createOrchestrationContext(): OrchestrationContext {
  return {
    state: 'initial',
    auditCorrelationId: `orch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}

/**
 * Transition context to new state
 */
export function transitionState(
  context: OrchestrationContext,
  newState: OrchestrationState,
  updates?: Partial<OrchestrationContext>
): OrchestrationContext {
  if (!isValidTransition(context.state, newState)) {
    return {
      ...context,
      state: 'error',
      error: `Invalid state transition from ${context.state} to ${newState}`,
    };
  }

  return {
    ...context,
    ...updates,
    state: newState,
  };
}
