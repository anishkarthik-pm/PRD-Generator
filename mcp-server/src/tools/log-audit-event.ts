/**
 * MCP Tool: log_audit_event
 * Logs custom audit events for PRD operations.
 */

import { z } from 'zod';
import { getAuditLogger } from '../utils/audit-logger.js';
import { EventOutcome, EventSeverity, ToolName } from '../schemas/audit-event.schema.js';

// Tool input schema
export const LogAuditEventInputSchema = z.object({
  eventType: z.enum([
    'prd_reviewed',
    'prd_approved',
    'prd_rejected',
    'brand_compliance_check',
    'version_upgrade',
    'export_completed',
    'custom',
  ]).describe('Type of audit event'),
  message: z.string().describe('Human-readable event message'),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('info').describe('Event severity'),
  prdId: z.string().optional().describe('Associated PRD ID'),
  prdVersion: z.string().optional().describe('Associated PRD version'),
  actor: z.string().describe('Actor who triggered the event'),
  metadata: z.record(z.unknown()).optional().describe('Additional event metadata'),
});

export type LogAuditEventInput = z.infer<typeof LogAuditEventInputSchema>;

// Tool output schema
export const LogAuditEventOutputSchema = z.object({
  success: z.boolean(),
  eventId: z.string().optional(),
  timestamp: z.string().optional(),
  error: z.string().optional(),
});

export type LogAuditEventOutput = z.infer<typeof LogAuditEventOutputSchema>;

/**
 * MCP Tool handler: log_audit_event
 */
export async function logAuditEvent(
  input: LogAuditEventInput,
  actorId: string = 'claude'
): Promise<LogAuditEventOutput> {
  const auditLogger = getAuditLogger();

  try {
    // Map event type to outcome
    const outcomeMap: Record<string, EventOutcome> = {
      prd_reviewed: 'success',
      prd_approved: 'success',
      prd_rejected: 'rejected',
      brand_compliance_check: 'success',
      version_upgrade: 'success',
      export_completed: 'success',
      custom: 'success',
    };

    const outcome = outcomeMap[input.eventType] || 'success';

    // Log the event
    const event = await auditLogger.logToolInvocation({
      toolName: 'log_audit_event',
      actorId: input.actor,
      actorType: 'user',
      outcome,
      message: `[${input.eventType.toUpperCase()}] ${input.message}`,
      input: {
        eventType: input.eventType,
        metadata: input.metadata,
      },
      prdId: input.prdId,
      prdVersion: input.prdVersion,
      severity: input.severity as EventSeverity,
    });

    return {
      success: true,
      eventId: event.eventId,
      timestamp: event.timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get audit history for a PRD
 */
export async function getAuditHistory(
  prdId: string
): Promise<{
  events: Array<{
    eventId: string;
    timestamp: string;
    toolName: string;
    outcome: string;
    message: string;
  }>;
}> {
  const auditLogger = getAuditLogger();
  const events = auditLogger.getEventsForPRD(prdId);

  return {
    events: events.map(e => ({
      eventId: e.eventId,
      timestamp: e.timestamp,
      toolName: e.toolName,
      outcome: e.outcome,
      message: e.message,
    })),
  };
}

/**
 * Export audit log for date range
 */
export async function exportAuditLog(
  startDate: string,
  endDate: string
): Promise<{
  entries: Array<{
    timestamp: string;
    eventId: string;
    toolName: string;
    outcome: string;
    severity: string;
    message: string;
    actor: string;
    prdId?: string;
  }>;
}> {
  const auditLogger = getAuditLogger();
  const entries = await auditLogger.exportAuditLog(
    new Date(startDate),
    new Date(endDate)
  );

  return { entries };
}

/**
 * MCP Tool definition for registration
 */
export const logAuditEventTool = {
  name: 'log_audit_event',
  description: 'Log custom audit events for PRD operations.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      eventType: {
        type: 'string',
        enum: [
          'prd_reviewed',
          'prd_approved',
          'prd_rejected',
          'brand_compliance_check',
          'version_upgrade',
          'export_completed',
          'custom',
        ],
        description: 'Type of audit event',
      },
      message: {
        type: 'string',
        description: 'Human-readable event message',
      },
      severity: {
        type: 'string',
        enum: ['info', 'warning', 'error', 'critical'],
        default: 'info',
        description: 'Event severity',
      },
      prdId: {
        type: 'string',
        description: 'Associated PRD ID',
      },
      prdVersion: {
        type: 'string',
        description: 'Associated PRD version',
      },
      actor: {
        type: 'string',
        description: 'Actor who triggered the event',
      },
      metadata: {
        type: 'object',
        description: 'Additional event metadata',
      },
    },
    required: ['eventType', 'message', 'actor'],
  },
  handler: logAuditEvent,
};
