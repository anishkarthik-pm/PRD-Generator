/**
 * Audit Event Schema
 * Defines the structure for audit logging of all MCP tool invocations.
 */

import { z } from 'zod';

// Tool name enum
export const ToolNameSchema = z.enum([
  'load_brand_guidelines',
  'parse_prd_content',
  'create_or_update_google_doc',
  'sync_prd_master_sheet',
  'append_change_log',
  'generate_html_wireframes',
  'log_audit_event',
]);

// Event outcome enum
export const EventOutcomeSchema = z.enum([
  'success',
  'failure',
  'rejected',
  'pending_approval',
  'cancelled',
]);

// Event severity enum
export const EventSeveritySchema = z.enum([
  'info',
  'warning',
  'error',
  'critical',
]);

// Resource reference schema
export const ResourceReferenceSchema = z.object({
  type: z.enum(['google_doc', 'google_sheet', 'html_file', 'brand_profile', 'prd', 'audit_log']),
  id: z.string().min(1),
  url: z.string().url().optional(),
  version: z.string().optional(),
});

// Change detail schema
export const ChangeDetailSchema = z.object({
  field: z.string().min(1),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  changeType: z.enum(['added', 'modified', 'removed']),
});

// Audit event schema
export const AuditEventSchema = z.object({
  // Event identification
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),

  // Tool information
  toolName: ToolNameSchema,
  toolVersion: z.string().optional(),

  // Actor information
  actor: z.object({
    type: z.enum(['claude', 'user', 'system']),
    id: z.string().min(1),
    sessionId: z.string().optional(),
  }),

  // Event details
  outcome: EventOutcomeSchema,
  severity: EventSeveritySchema,
  message: z.string().min(1),

  // Input/Output
  input: z.object({
    parameters: z.record(z.unknown()),
    sanitized: z.boolean().default(true),
  }),
  output: z.object({
    result: z.unknown().optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
  }).optional(),

  // Resources affected
  resourcesAffected: z.array(ResourceReferenceSchema).optional(),

  // Change tracking
  changes: z.array(ChangeDetailSchema).optional(),

  // Approval tracking
  approval: z.object({
    required: z.boolean(),
    granted: z.boolean().optional(),
    grantedBy: z.string().optional(),
    grantedAt: z.string().datetime().optional(),
    reason: z.string().optional(),
  }).optional(),

  // Context
  context: z.object({
    prdId: z.string().optional(),
    prdVersion: z.string().optional(),
    brandProfileVersion: z.string().optional(),
    correlationId: z.string().optional(),
  }).optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),
});

// Type exports
export type ToolName = z.infer<typeof ToolNameSchema>;
export type EventOutcome = z.infer<typeof EventOutcomeSchema>;
export type EventSeverity = z.infer<typeof EventSeveritySchema>;
export type ResourceReference = z.infer<typeof ResourceReferenceSchema>;
export type ChangeDetail = z.infer<typeof ChangeDetailSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// Validation helper
export function validateAuditEvent(data: unknown): AuditEvent {
  return AuditEventSchema.parse(data);
}

// Audit log entry (simplified for append-only log)
export const AuditLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  eventId: z.string().uuid(),
  toolName: ToolNameSchema,
  outcome: EventOutcomeSchema,
  severity: EventSeveritySchema,
  message: z.string(),
  actor: z.string(),
  prdId: z.string().optional(),
  prdVersion: z.string().optional(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// Helper to create audit event
export function createAuditEvent(params: {
  toolName: ToolName;
  actor: AuditEvent['actor'];
  outcome: EventOutcome;
  message: string;
  input: Record<string, unknown>;
  output?: AuditEvent['output'];
  resourcesAffected?: ResourceReference[];
  changes?: ChangeDetail[];
  approval?: AuditEvent['approval'];
  context?: AuditEvent['context'];
  severity?: EventSeverity;
}): AuditEvent {
  const { v4: uuidv4 } = require('uuid');

  return {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    toolName: params.toolName,
    actor: params.actor,
    outcome: params.outcome,
    severity: params.severity || (params.outcome === 'failure' ? 'error' : 'info'),
    message: params.message,
    input: {
      parameters: params.input,
      sanitized: true,
    },
    output: params.output,
    resourcesAffected: params.resourcesAffected,
    changes: params.changes,
    approval: params.approval,
    context: params.context,
  };
}

// Helper to format audit log line
export function formatAuditLogLine(event: AuditEvent): string {
  const parts = [
    event.timestamp,
    `[${event.severity.toUpperCase()}]`,
    `[${event.toolName}]`,
    `[${event.outcome}]`,
    event.message,
  ];

  if (event.context?.prdId) {
    parts.push(`PRD:${event.context.prdId}`);
  }

  return parts.join(' | ');
}
