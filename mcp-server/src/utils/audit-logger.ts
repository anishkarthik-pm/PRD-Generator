/**
 * Audit Logger
 * Provides immutable audit trail for all MCP tool operations.
 */

import { AuditEvent, AuditLogEntry, ToolName, EventOutcome, EventSeverity, createAuditEvent, formatAuditLogLine } from '../schemas/audit-event.schema.js';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditLoggerConfig {
  logDirectory: string;
  maxLogFileSize: number; // bytes
  retentionDays: number;
  enableConsoleOutput: boolean;
}

const DEFAULT_CONFIG: AuditLoggerConfig = {
  logDirectory: './audit-logs',
  maxLogFileSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 90,
  enableConsoleOutput: true,
};

export class AuditLogger {
  private config: AuditLoggerConfig;
  private currentLogFile: string;
  private events: AuditEvent[] = [];

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureLogDirectory();
    this.currentLogFile = this.getCurrentLogFileName();
  }

  /**
   * Log a tool invocation event
   */
  async logToolInvocation(params: {
    toolName: ToolName;
    actorId: string;
    actorType: 'claude' | 'user' | 'system';
    sessionId?: string;
    outcome: EventOutcome;
    message: string;
    input: Record<string, unknown>;
    output?: {
      result?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };
    prdId?: string;
    prdVersion?: string;
    brandProfileVersion?: string;
    correlationId?: string;
    severity?: EventSeverity;
  }): Promise<AuditEvent> {
    const event = createAuditEvent({
      toolName: params.toolName,
      actor: {
        type: params.actorType,
        id: params.actorId,
        sessionId: params.sessionId,
      },
      outcome: params.outcome,
      message: params.message,
      input: params.input,
      output: params.output,
      context: {
        prdId: params.prdId,
        prdVersion: params.prdVersion,
        brandProfileVersion: params.brandProfileVersion,
        correlationId: params.correlationId,
      },
      severity: params.severity,
    });

    await this.writeEvent(event);
    return event;
  }

  /**
   * Log an approval event
   */
  async logApproval(params: {
    toolName: ToolName;
    actorId: string;
    approved: boolean;
    reason?: string;
    prdId?: string;
    prdVersion?: string;
    correlationId?: string;
  }): Promise<AuditEvent> {
    const event = createAuditEvent({
      toolName: params.toolName,
      actor: {
        type: 'user',
        id: params.actorId,
      },
      outcome: params.approved ? 'success' : 'cancelled',
      message: params.approved
        ? `Approval granted for ${params.toolName}`
        : `Approval denied for ${params.toolName}`,
      input: { approved: params.approved },
      approval: {
        required: true,
        granted: params.approved,
        grantedBy: params.actorId,
        grantedAt: new Date().toISOString(),
        reason: params.reason,
      },
      context: {
        prdId: params.prdId,
        prdVersion: params.prdVersion,
        correlationId: params.correlationId,
      },
    });

    await this.writeEvent(event);
    return event;
  }

  /**
   * Log a validation failure
   */
  async logValidationFailure(params: {
    toolName: ToolName;
    actorId: string;
    validationErrors: string[];
    input: Record<string, unknown>;
    prdId?: string;
  }): Promise<AuditEvent> {
    const event = createAuditEvent({
      toolName: params.toolName,
      actor: {
        type: 'claude',
        id: params.actorId,
      },
      outcome: 'rejected',
      severity: 'warning',
      message: `Validation failed: ${params.validationErrors.length} error(s)`,
      input: params.input,
      output: {
        errorCode: 'VALIDATION_FAILED',
        errorMessage: params.validationErrors.join('; '),
      },
      context: {
        prdId: params.prdId,
      },
    });

    await this.writeEvent(event);
    return event;
  }

  /**
   * Get audit events for a specific PRD
   */
  getEventsForPRD(prdId: string): AuditEvent[] {
    return this.events.filter(e => e.context?.prdId === prdId);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 100): AuditEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get events by tool name
   */
  getEventsByTool(toolName: ToolName): AuditEvent[] {
    return this.events.filter(e => e.toolName === toolName);
  }

  /**
   * Export audit log for a date range
   */
  async exportAuditLog(
    startDate: Date,
    endDate: Date
  ): Promise<AuditLogEntry[]> {
    const filteredEvents = this.events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });

    return filteredEvents.map(e => ({
      timestamp: e.timestamp,
      eventId: e.eventId,
      toolName: e.toolName,
      outcome: e.outcome,
      severity: e.severity,
      message: e.message,
      actor: e.actor.id,
      prdId: e.context?.prdId,
      prdVersion: e.context?.prdVersion,
    }));
  }

  /**
   * Write event to log file
   */
  private async writeEvent(event: AuditEvent): Promise<void> {
    this.events.push(event);

    const logLine = formatAuditLogLine(event);

    if (this.config.enableConsoleOutput) {
      console.log(`[AUDIT] ${logLine}`);
    }

    // Write to file
    try {
      await this.rotateLogIfNeeded();
      const logPath = path.join(this.config.logDirectory, this.currentLogFile);
      fs.appendFileSync(logPath, logLine + '\n');

      // Also write full JSON event
      const jsonLogPath = path.join(
        this.config.logDirectory,
        this.currentLogFile.replace('.log', '.json')
      );
      const existingJson = fs.existsSync(jsonLogPath)
        ? JSON.parse(fs.readFileSync(jsonLogPath, 'utf-8'))
        : [];
      existingJson.push(event);
      fs.writeFileSync(jsonLogPath, JSON.stringify(existingJson, null, 2));
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  /**
   * Get current log file name
   */
  private getCurrentLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return `audit-${date}.log`;
  }

  /**
   * Rotate log file if needed
   */
  private async rotateLogIfNeeded(): Promise<void> {
    const newFileName = this.getCurrentLogFileName();

    // Check date change
    if (newFileName !== this.currentLogFile) {
      this.currentLogFile = newFileName;
      return;
    }

    // Check file size
    const logPath = path.join(this.config.logDirectory, this.currentLogFile);
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size >= this.config.maxLogFileSize) {
        const timestamp = Date.now();
        const rotatedName = this.currentLogFile.replace('.log', `-${timestamp}.log`);
        fs.renameSync(logPath, path.join(this.config.logDirectory, rotatedName));
      }
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let deletedCount = 0;
    const files = fs.readdirSync(this.config.logDirectory);

    for (const file of files) {
      if (file.startsWith('audit-')) {
        const dateMatch = file.match(/audit-(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(this.config.logDirectory, file));
            deletedCount++;
          }
        }
      }
    }

    return deletedCount;
  }
}

// Singleton instance
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(config?: Partial<AuditLoggerConfig>): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(config);
  }
  return auditLoggerInstance;
}

export function resetAuditLogger(): void {
  auditLoggerInstance = null;
}
