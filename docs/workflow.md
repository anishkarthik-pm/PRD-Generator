# PRD Automation Workflow

This document describes the complete workflow for processing PRDs through the automation system.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRD AUTOMATION FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │    START     │
     └──────┬───────┘
            │
            ▼
┌───────────────────────┐
│ 1. Load Brand         │ ◄─── Brand profile JSON
│    Guidelines         │      (Required first step)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 2. Parse PRD          │ ◄─── Raw PRD input
│    Content            │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐     ┌─────────────────┐
│ 3. Validate PRD       │────►│ Validation      │
│    Against Brand      │     │ Errors?         │
└───────────┬───────────┘     └────────┬────────┘
            │                          │ Yes
            │ No                       ▼
            │                 ┌─────────────────┐
            │                 │ Fix Errors &    │
            │                 │ Re-parse        │──┐
            │                 └─────────────────┘  │
            │                          ▲           │
            │                          └───────────┘
            ▼
┌───────────────────────┐
│ 4. Generate Review    │
│    Artifacts          │
│    • PRD Summary      │
│    • Table Preview    │
│    • Wireframe Preview│
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 5. Propose Version    │ ◄─── v1.0 → v1.1 or v2.0
│    Increment          │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐     ┌─────────────────┐
│ 6. Request User       │────►│ Approved?       │
│    Approval           │     └────────┬────────┘
└───────────────────────┘              │
                                       │ No
                              ┌────────┴────────┐
                              │                 │
                              ▼                 ▼
                      ┌─────────────┐   ┌─────────────┐
                      │    STOP     │   │ Modify &    │
                      │ (Rejected)  │   │ Re-process  │
                      └─────────────┘   └──────┬──────┘
                                               │
            ┌──────────────────────────────────┘
            │ Yes (Approved)
            ▼
┌───────────────────────┐
│ 7. Update Google Doc  │────► Google Docs PRD
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 8. Sync PRD Master    │────► Google Sheets
│    Sheet              │      (PRD_MASTER)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 9. Append Change      │────► Google Sheets
│    Log Entry          │      (CHANGE_LOG)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 10. Generate HTML     │────► ./wireframes/
│     Wireframes        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ 11. Log Audit         │────► ./audit-logs/
│     Event             │
└───────────┬───────────┘
            │
            ▼
     ┌──────────────┐
     │   COMPLETE   │
     └──────────────┘
```

## State Machine

The orchestrator maintains these states:

| State | Description | Next States |
|-------|-------------|-------------|
| `initial` | Starting state | `brand_loaded`, `error` |
| `brand_loaded` | Brand guidelines loaded | `prd_parsed`, `error` |
| `prd_parsed` | PRD parsed into structure | `prd_validated`, `error` |
| `prd_validated` | PRD validated against brand | `review_artifacts_generated`, `error` |
| `review_artifacts_generated` | Review materials ready | `pending_approval` |
| `pending_approval` | Waiting for user approval | `approved`, `rejected` |
| `approved` | User approved changes | `google_doc_updated`, `error` |
| `google_doc_updated` | Google Doc created/updated | `sheets_synced`, `error` |
| `sheets_synced` | PRD Master Sheet synced | `change_log_appended`, `error` |
| `change_log_appended` | Change log entry added | `wireframes_generated`, `error` |
| `wireframes_generated` | Wireframes generated | `completed`, `error` |
| `completed` | All operations successful | - |
| `rejected` | User rejected approval | - |
| `error` | Error occurred | - |

## Versioning Rules

### Version Format
- Format: `vX.Y` where X is major, Y is minor
- Examples: v1.0, v1.1, v2.0

### When to Increment

**Major Version (X++):**
- Modules added or removed
- Features added or removed
- Significant scope changes

**Minor Version (Y++):**
- Content updates within existing structure
- Description changes
- Edge case additions
- Success metric updates

### Version Constraints
- Initial version: v1.0
- Downgrades: **FORBIDDEN**
- Sequential increments only (no skipping)

## Approval Requirements

The following operations require explicit user approval:

| Tool | Requires Approval |
|------|-------------------|
| `load_brand_guidelines` | No |
| `parse_prd_content` | No |
| `create_or_update_google_doc` | **Yes** |
| `sync_prd_master_sheet` | **Yes** |
| `append_change_log` | **Yes** |
| `generate_html_wireframes` | **Yes** |
| `log_audit_event` | No |

### Approval Request Format

```markdown
## Approval Required

I'm ready to execute the following operations:

1. **Google Docs:** Create PRD document "Cycle Count for Retail Store Operations"
2. **Google Sheets:** Sync PRD Master Sheet (15 rows)
3. **Change Log:** Append entry for v1.0
4. **Wireframes:** Generate 12 HTML wireframe files

**Do you approve these actions?** Please respond 'yes' or 'no'.
```

## Error Handling

### Recoverable Errors
- Network timeouts → Retry with backoff
- Validation warnings → Show warnings, allow proceed
- Google API rate limits → Retry with backoff

### Non-Recoverable Errors
- Brand guidelines not loaded → Block all PRD operations
- Validation errors → Block until fixed
- Version downgrade attempted → Block
- Approval denied → Stop workflow

### Error Response Format

```json
{
  "success": false,
  "error": "Descriptive error message",
  "errorCode": "ERROR_CODE",
  "recoverable": true,
  "suggestion": "Try this to fix the issue"
}
```

## Audit Trail

All operations are logged to the audit system with:

- Timestamp (ISO 8601)
- Event ID (UUID)
- Tool name
- Actor (user/system)
- Outcome (success/failure/rejected)
- Input parameters (sanitized)
- Output result
- PRD ID and version (if applicable)
- Brand profile version (if applicable)

### Audit Log Retention
- Default: 90 days
- Log files rotate at 10MB
- Stored in JSON and plain text formats
