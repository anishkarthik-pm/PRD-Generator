# MCP Tools Reference

This document describes all MCP tools available in the PRD Automation System.

## Tool Execution Order

Tools MUST be called in this order for proper PRD processing:

```
1. load_brand_guidelines     (Required first)
2. parse_prd_content         (Requires brand loaded)
3. create_or_update_google_doc  (Requires approval)
4. sync_prd_master_sheet     (Requires approval)
5. append_change_log         (Requires approval)
6. generate_html_wireframes  (Requires approval)
7. log_audit_event           (Always available)
```

---

## 1. load_brand_guidelines

Loads and validates a brand profile for PRD governance.

### Input Schema

```json
{
  "brandProfilePath": "string (optional) - Path to brand profile JSON",
  "brandProfileJson": "string (optional) - Brand profile as JSON string",
  "brandName": "string (optional) - Brand name to load from defaults"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "brandProfile": "object (optional) - Full brand profile",
  "brandName": "string (optional)",
  "version": "string (optional)",
  "designPrinciplesCount": "number (optional)",
  "uiConstraintsCount": "number (optional)",
  "disallowedPatterns": "string[] (optional)",
  "error": "string (optional)"
}
```

### Example

```json
// Input
{
  "brandName": "RetailOps"
}

// Output
{
  "success": true,
  "brandName": "RetailOps",
  "version": "v1.0",
  "designPrinciplesCount": 4,
  "uiConstraintsCount": 8,
  "disallowedPatterns": ["Modal", "Hover state", "Carousel", "Infinite scroll"]
}
```

---

## 2. parse_prd_content

Parses raw PRD input into structured JSON format.

### Input Schema

```json
{
  "prdInput": {
    "title": "string (required)",
    "owner": "string (required)",
    "objective": "string (required)",
    "businessValue": "string (required)",
    "targetUsers": "string[] (required)",
    "inScope": "string[] (required)",
    "outOfScope": "string[]",
    "assumptions": "string[]",
    "modules": "array (required)"
  },
  "existingPrdId": "string (optional) - For updates",
  "baseVersion": "string (optional) - e.g., v1.0"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "prd": "object (optional) - Structured PRD",
  "validationResult": {
    "structureValid": "boolean",
    "brandValid": "boolean",
    "completenessScore": "number (0-100)",
    "errors": "string[]",
    "warnings": "string[]"
  },
  "error": "string (optional)"
}
```

---

## 3. create_or_update_google_doc

Creates or updates a PRD document in Google Docs.

### Input Schema

```json
{
  "prd": "object (required) - Structured PRD",
  "documentId": "string (optional) - For updates",
  "shareWith": "string[] (optional) - Email addresses",
  "approved": "boolean (required) - Must be true"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "documentId": "string (optional)",
  "documentUrl": "string (optional)",
  "operation": "'created' | 'updated' (optional)",
  "title": "string (optional)",
  "error": "string (optional)",
  "requiresApproval": "boolean (optional)"
}
```

### Approval Required

This tool requires `approved: true` to execute. Without approval, it returns:
```json
{
  "success": false,
  "requiresApproval": true,
  "error": "Operation requires user approval."
}
```

---

## 4. sync_prd_master_sheet

Syncs PRD data to Google Sheets PRD_MASTER sheet.

### Input Schema

```json
{
  "prd": "object (required) - Structured PRD",
  "spreadsheetId": "string (optional)",
  "createIfNotExists": "boolean (default: true)",
  "approved": "boolean (required)"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "spreadsheetId": "string (optional)",
  "spreadsheetUrl": "string (optional)",
  "rowsUpdated": "number (optional)",
  "operation": "'created' | 'synced' (optional)",
  "error": "string (optional)"
}
```

### Sheet Structure

Creates PRD_MASTER sheet with columns:
- PRD ID
- Module
- Feature
- Feature ID
- Description
- Priority
- Flow Name
- Flow Description
- Owner
- Status

---

## 5. append_change_log

Appends an entry to the CHANGE_LOG sheet (append-only).

### Input Schema

```json
{
  "version": "string (required) - e.g., v1.0",
  "changedBy": "string (required)",
  "changeSummary": "string (required)",
  "spreadsheetId": "string (optional)",
  "prdId": "string (optional)",
  "approved": "boolean (required)"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "spreadsheetId": "string (optional)",
  "row": "number (optional)",
  "entry": {
    "version": "string",
    "date": "string",
    "changedBy": "string",
    "changeSummary": "string",
    "brandVersion": "string"
  },
  "error": "string (optional)"
}
```

---

## 6. generate_html_wireframes

Generates low-fidelity HTML wireframes from PRD user flows.

### Input Schema

```json
{
  "prd": "object (required) - Structured PRD",
  "outputDirectory": "string (optional)",
  "approved": "boolean (required)"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "outputDirectory": "string (optional)",
  "totalPages": "number (optional)",
  "files": [
    {
      "fileName": "string",
      "filePath": "string",
      "flowName": "string",
      "stepNumber": "number",
      "title": "string"
    }
  ],
  "error": "string (optional)"
}
```

### Wireframe Rules

Generated wireframes follow these rules:
- Low fidelity only (no high-fi design)
- Mobile-first (max-width: 480px)
- White background
- Brand color tokens applied
- No modals or hover-only actions
- One primary CTA per screen
- One HTML file per flow step

---

## 7. log_audit_event

Logs custom audit events for compliance and tracking.

### Input Schema

```json
{
  "eventType": "'prd_reviewed' | 'prd_approved' | 'prd_rejected' | 'brand_compliance_check' | 'version_upgrade' | 'export_completed' | 'custom'",
  "message": "string (required)",
  "severity": "'info' | 'warning' | 'error' | 'critical' (default: 'info')",
  "prdId": "string (optional)",
  "prdVersion": "string (optional)",
  "actor": "string (required)",
  "metadata": "object (optional)"
}
```

### Output Schema

```json
{
  "success": "boolean",
  "eventId": "string (optional) - UUID",
  "timestamp": "string (optional) - ISO 8601",
  "error": "string (optional)"
}
```

---

## Error Codes

Common error codes returned by tools:

| Code | Description |
|------|-------------|
| `BRAND_NOT_LOADED` | Brand guidelines must be loaded first |
| `VALIDATION_FAILED` | PRD validation failed |
| `APPROVAL_REQUIRED` | Operation requires user approval |
| `VERSION_DOWNGRADE` | Version downgrades not allowed |
| `GOOGLE_AUTH_ERROR` | Google API authentication failed |
| `NETWORK_ERROR` | Network connectivity issue |
