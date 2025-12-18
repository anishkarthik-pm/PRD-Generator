/**
 * Google Auth Service
 * Handles Google Service Account authentication for Docs and Sheets APIs.
 */

import { google, Auth } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface GoogleAuthConfig {
  serviceAccountKeyPath?: string;
  serviceAccountKey?: {
    client_email: string;
    private_key: string;
    project_id: string;
  };
  scopes?: string[];
}

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export class GoogleAuthService {
  private auth: Auth.GoogleAuth | null = null;
  private config: GoogleAuthConfig;
  private initialized: boolean = false;

  constructor(config: GoogleAuthConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the auth service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const scopes = this.config.scopes || DEFAULT_SCOPES;

    if (this.config.serviceAccountKey) {
      // Use provided credentials object
      this.auth = new google.auth.GoogleAuth({
        credentials: this.config.serviceAccountKey,
        scopes,
      });
    } else if (this.config.serviceAccountKeyPath) {
      // Load from file path
      const keyPath = path.resolve(this.config.serviceAccountKeyPath);
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Service account key file not found: ${keyPath}`);
      }
      this.auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes,
      });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Load from environment variable (JSON string)
      try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes,
        });
      } catch (error) {
        throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY environment variable');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use default application credentials
      this.auth = new google.auth.GoogleAuth({
        scopes,
      });
    } else {
      throw new Error(
        'No Google credentials configured. Provide serviceAccountKeyPath, serviceAccountKey, ' +
        'GOOGLE_SERVICE_ACCOUNT_KEY env var, or GOOGLE_APPLICATION_CREDENTIALS env var.'
      );
    }

    this.initialized = true;
  }

  /**
   * Get authenticated client
   */
  async getAuthClient(): Promise<Auth.GoogleAuth> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.auth) {
      throw new Error('Auth not initialized');
    }
    return this.auth;
  }

  /**
   * Get Google Docs API client
   */
  async getDocsClient() {
    const auth = await this.getAuthClient();
    return google.docs({ version: 'v1', auth });
  }

  /**
   * Get Google Sheets API client
   */
  async getSheetsClient() {
    const auth = await this.getAuthClient();
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Get Google Drive API client
   */
  async getDriveClient() {
    const auth = await this.getAuthClient();
    return google.drive({ version: 'v3', auth });
  }

  /**
   * Verify credentials are valid
   */
  async verifyCredentials(): Promise<{
    valid: boolean;
    email?: string;
    projectId?: string;
    error?: string;
  }> {
    try {
      const auth = await this.getAuthClient();
      const credentials = await auth.getCredentials();

      return {
        valid: true,
        email: credentials.client_email,
        projectId: (credentials as Record<string, unknown>).project_id as string | undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let authServiceInstance: GoogleAuthService | null = null;

export function getGoogleAuthService(config?: GoogleAuthConfig): GoogleAuthService {
  if (!authServiceInstance) {
    authServiceInstance = new GoogleAuthService(config);
  }
  return authServiceInstance;
}

export function resetGoogleAuthService(): void {
  authServiceInstance = null;
}
