/**
 * Google Sheets Service
 * Handles PRD Master sheet and Change Log management.
 */

import { sheets_v4 } from 'googleapis';
import { getGoogleAuthService } from './google-auth.js';
import { PRD, Feature, Module } from '../schemas/prd.schema.js';

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  prdMasterSheetName: string;
  changeLogSheetName: string;
}

const DEFAULT_CONFIG: GoogleSheetsConfig = {
  prdMasterSheetName: 'PRD_MASTER',
  changeLogSheetName: 'CHANGE_LOG',
};

export interface SpreadsheetCreateResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  prdMasterSheetId: number;
  changeLogSheetId: number;
}

export interface ChangeLogEntry {
  version: string;
  date: string;
  changedBy: string;
  changeSummary: string;
  brandVersion: string;
}

export interface PRDMasterRow {
  prdId: string;
  module: string;
  feature: string;
  featureId: string;
  description: string;
  priority: string;
  flowName: string;
  flowDescription: string;
  owner: string;
  status: string;
}

export class GoogleSheetsService {
  private config: GoogleSheetsConfig;

  constructor(config: Partial<GoogleSheetsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new spreadsheet for PRD tracking
   */
  async createPRDSpreadsheet(title: string): Promise<SpreadsheetCreateResult> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    // Create spreadsheet with two sheets
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${title} - PRD Tracking`,
        },
        sheets: [
          {
            properties: {
              title: this.config.prdMasterSheetName,
              sheetId: 0,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
          {
            properties: {
              title: this.config.changeLogSheetName,
              sheetId: 1,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = response.data.spreadsheetId!;

    // Add headers to PRD_MASTER
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.config.prdMasterSheetName}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'PRD ID',
          'Module',
          'Feature',
          'Feature ID',
          'Description',
          'Priority',
          'Flow Name',
          'Flow Description',
          'Owner',
          'Status',
        ]],
      },
    });

    // Add headers to CHANGE_LOG
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${this.config.changeLogSheetName}!A1:E1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Version',
          'Date',
          'Changed By',
          'Change Summary',
          'Brand Version',
        ]],
      },
    });

    // Format headers (bold, background color)
    await this.formatHeaders(spreadsheetId);

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      prdMasterSheetId: 0,
      changeLogSheetId: 1,
    };
  }

  /**
   * Format headers with styling
   */
  private async formatHeaders(spreadsheetId: string): Promise<void> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Format PRD_MASTER headers
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          // Format CHANGE_LOG headers
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.4, green: 0.2, blue: 0.6 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          // Auto-resize columns for PRD_MASTER
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 10,
              },
            },
          },
          // Auto-resize columns for CHANGE_LOG
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 1,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 5,
              },
            },
          },
        ],
      },
    });
  }

  /**
   * Sync PRD data to PRD_MASTER sheet
   */
  async syncPRDMaster(
    spreadsheetId: string,
    prd: PRD
  ): Promise<{ rowsUpdated: number }> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    // Build rows from PRD
    const rows = this.buildPRDMasterRows(prd);

    // Clear existing data (except headers)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${this.config.prdMasterSheetName}!A2:J`,
    });

    // Write new data
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.config.prdMasterSheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows.map(row => [
            row.prdId,
            row.module,
            row.feature,
            row.featureId,
            row.description,
            row.priority,
            row.flowName,
            row.flowDescription,
            row.owner,
            row.status,
          ]),
        },
      });
    }

    return { rowsUpdated: rows.length };
  }

  /**
   * Build PRD Master rows from PRD data
   */
  private buildPRDMasterRows(prd: PRD): PRDMasterRow[] {
    const rows: PRDMasterRow[] = [];

    for (const module of prd.modules) {
      for (const feature of module.features) {
        // Add a row for each user flow
        for (const flow of feature.userFlows) {
          rows.push({
            prdId: prd.prdId,
            module: module.moduleName,
            feature: feature.featureName,
            featureId: feature.featureId,
            description: feature.description,
            priority: feature.priority,
            flowName: flow.flowName,
            flowDescription: flow.description,
            owner: feature.owner || prd.owner,
            status: feature.status,
          });
        }

        // If no flows, add one row for the feature
        if (feature.userFlows.length === 0) {
          rows.push({
            prdId: prd.prdId,
            module: module.moduleName,
            feature: feature.featureName,
            featureId: feature.featureId,
            description: feature.description,
            priority: feature.priority,
            flowName: '',
            flowDescription: '',
            owner: feature.owner || prd.owner,
            status: feature.status,
          });
        }
      }
    }

    return rows;
  }

  /**
   * Append entry to change log (append-only)
   */
  async appendChangeLog(
    spreadsheetId: string,
    entry: ChangeLogEntry
  ): Promise<{ row: number }> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    // Append new row
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${this.config.changeLogSheetName}!A:E`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          entry.version,
          entry.date,
          entry.changedBy,
          entry.changeSummary,
          entry.brandVersion,
        ]],
      },
    });

    // Extract row number from updated range
    const updatedRange = response.data.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/!A(\d+)/);
    const row = rowMatch ? parseInt(rowMatch[1], 10) : -1;

    return { row };
  }

  /**
   * Get change log history
   */
  async getChangeLogHistory(
    spreadsheetId: string,
    limit?: number
  ): Promise<ChangeLogEntry[]> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.config.changeLogSheetName}!A2:E`,
    });

    const rows = response.data.values || [];
    let entries = rows.map(row => ({
      version: row[0] || '',
      date: row[1] || '',
      changedBy: row[2] || '',
      changeSummary: row[3] || '',
      brandVersion: row[4] || '',
    }));

    // Return most recent first
    entries = entries.reverse();

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return entries;
  }

  /**
   * Get PRD Master data
   */
  async getPRDMasterData(spreadsheetId: string): Promise<PRDMasterRow[]> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.config.prdMasterSheetName}!A2:J`,
    });

    const rows = response.data.values || [];
    return rows.map(row => ({
      prdId: row[0] || '',
      module: row[1] || '',
      feature: row[2] || '',
      featureId: row[3] || '',
      description: row[4] || '',
      priority: row[5] || '',
      flowName: row[6] || '',
      flowDescription: row[7] || '',
      owner: row[8] || '',
      status: row[9] || '',
    }));
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheetMetadata(spreadsheetId: string): Promise<{
    title: string;
    sheets: string[];
    lastModified?: string;
  }> {
    const authService = getGoogleAuthService();
    const sheets = await authService.getSheetsClient();
    const drive = await authService.getDriveClient();

    const [sheetResponse, driveResponse] = await Promise.all([
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.title,sheets.properties.title',
      }),
      drive.files.get({
        fileId: spreadsheetId,
        fields: 'modifiedTime',
      }),
    ]);

    return {
      title: sheetResponse.data.properties?.title || 'Unknown',
      sheets: sheetResponse.data.sheets?.map(s => s.properties?.title || '') || [],
      lastModified: driveResponse.data.modifiedTime || undefined,
    };
  }
}

// Singleton instance
let sheetsServiceInstance: GoogleSheetsService | null = null;

export function getGoogleSheetsService(config?: Partial<GoogleSheetsConfig>): GoogleSheetsService {
  if (!sheetsServiceInstance) {
    sheetsServiceInstance = new GoogleSheetsService(config);
  }
  return sheetsServiceInstance;
}

export function resetGoogleSheetsService(): void {
  sheetsServiceInstance = null;
}
