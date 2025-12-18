/**
 * Schema Exports
 * Central export point for all schema types and validators.
 */

// Brand Profile
export {
  BrandProfileSchema,
  ColorTokenSchema,
  TypographyTokenSchema,
  UIPatternConstraintSchema,
  DesignPrincipleSchema,
  ReferenceProductSchema,
  SpacingTokenSchema,
  ComponentConstraintSchema,
  validateBrandProfile,
  isPatternAllowed,
  getPrimaryColor,
  getDisallowedPatterns,
} from './brand-profile.schema.js';

export type {
  BrandProfile,
  ColorToken,
  TypographyToken,
  UIPatternConstraint,
  DesignPrinciple,
  ReferenceProduct,
  SpacingToken,
  ComponentConstraint,
} from './brand-profile.schema.js';

// PRD
export {
  PRDSchema,
  PRDInputSchema,
  PartialPRDSchema,
  ModuleSchema,
  FeatureSchema,
  UserFlowSchema,
  UserFlowStepSchema,
  SuccessMetricSchema,
  EdgeCaseSchema,
  BrandContextSchema,
  AssumptionSchema,
  ScopeItemSchema,
  VersionHistoryEntrySchema,
  validatePRD,
  generatePRDId,
  compareVersions,
  incrementVersion,
} from './prd.schema.js';

export type {
  PRD,
  PRDInput,
  PartialPRD,
  Module,
  Feature,
  UserFlow,
  UserFlowStep,
  SuccessMetric,
  EdgeCase,
  BrandContext,
  Assumption,
  ScopeItem,
  VersionHistoryEntry,
} from './prd.schema.js';

// Audit Event
export {
  AuditEventSchema,
  AuditLogEntrySchema,
  ToolNameSchema,
  EventOutcomeSchema,
  EventSeveritySchema,
  ResourceReferenceSchema,
  ChangeDetailSchema,
  validateAuditEvent,
  createAuditEvent,
  formatAuditLogLine,
} from './audit-event.schema.js';

export type {
  AuditEvent,
  AuditLogEntry,
  ToolName,
  EventOutcome,
  EventSeverity,
  ResourceReference,
  ChangeDetail,
} from './audit-event.schema.js';
