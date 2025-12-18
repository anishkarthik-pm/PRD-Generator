/**
 * Google Docs Service
 * Handles creating and updating PRD documents in Google Docs.
 */

import { docs_v1 } from 'googleapis';
import { getGoogleAuthService } from './google-auth.js';
import { PRD } from '../schemas/prd.schema.js';

export interface GoogleDocsConfig {
  templateDocId?: string;
  defaultFolderId?: string;
}

export interface DocumentCreateResult {
  documentId: string;
  documentUrl: string;
  title: string;
}

export interface DocumentUpdateResult {
  documentId: string;
  revisionsCreated: number;
  success: boolean;
}

export class GoogleDocsService {
  private config: GoogleDocsConfig;

  constructor(config: GoogleDocsConfig = {}) {
    this.config = config;
  }

  /**
   * Create a new PRD document from PRD data
   */
  async createPRDDocument(prd: PRD): Promise<DocumentCreateResult> {
    const authService = getGoogleAuthService();
    const docs = await authService.getDocsClient();

    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: {
        title: `${prd.title} - ${prd.version}`,
      },
    });

    const documentId = createResponse.data.documentId!;

    // Build document content
    const requests = this.buildPRDDocumentRequests(prd);

    // Update document with content
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests,
      },
    });

    return {
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
      title: prd.title,
    };
  }

  /**
   * Update an existing PRD document
   */
  async updatePRDDocument(
    documentId: string,
    prd: PRD
  ): Promise<DocumentUpdateResult> {
    const authService = getGoogleAuthService();
    const docs = await authService.getDocsClient();

    // Get current document to find content range
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;

    // Clear existing content (except first character)
    const clearRequests: docs_v1.Schema$Request[] = [];
    if (endIndex > 2) {
      clearRequests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }

    // Apply clear if needed
    if (clearRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: clearRequests,
        },
      });
    }

    // Build new content
    const contentRequests = this.buildPRDDocumentRequests(prd);

    // Update document with new content
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: contentRequests,
      },
    });

    // Update document title
    const drive = await authService.getDriveClient();
    await drive.files.update({
      fileId: documentId,
      requestBody: {
        name: `${prd.title} - ${prd.version}`,
      },
    });

    return {
      documentId,
      revisionsCreated: 1,
      success: true,
    };
  }

  /**
   * Build Google Docs API requests for PRD content
   */
  private buildPRDDocumentRequests(prd: PRD): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = [];
    let currentIndex = 1;

    // Helper to add text
    const addText = (text: string, style?: 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'NORMAL_TEXT') => {
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: text + '\n',
        },
      });

      if (style && style !== 'NORMAL_TEXT') {
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + text.length + 1,
            },
            paragraphStyle: {
              namedStyleType: style,
            },
            fields: 'namedStyleType',
          },
        });
      }

      currentIndex += text.length + 1;
    };

    // Helper to add bullet list
    const addBulletList = (items: string[]) => {
      for (const item of items) {
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: item + '\n',
          },
        });
        currentIndex += item.length + 1;
      }

      // Apply bullet formatting
      const startOfList = currentIndex - items.reduce((sum, item) => sum + item.length + 1, 0);
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: startOfList,
            endIndex: currentIndex,
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    };

    // Title
    addText(prd.title, 'HEADING_1');
    addText(`Version: ${prd.version} | Status: ${prd.status} | Owner: ${prd.owner}`);
    addText('');

    // Overview Section
    addText('Overview', 'HEADING_2');
    addText(prd.objective.statement);
    addText('');

    // Objectives Section
    addText('Objectives', 'HEADING_2');
    addText('Business Value:', 'HEADING_3');
    addText(prd.objective.businessValue);
    addText('');
    addText('Target Users:', 'HEADING_3');
    addBulletList(prd.objective.targetUsers);
    addText('');

    if (prd.objective.keyResults && prd.objective.keyResults.length > 0) {
      addText('Key Results:', 'HEADING_3');
      addBulletList(prd.objective.keyResults);
      addText('');
    }

    // In Scope Section
    addText('In Scope', 'HEADING_2');
    addBulletList(prd.inScope.map(s => s.rationale ? `${s.item} - ${s.rationale}` : s.item));
    addText('');

    // Out of Scope Section
    addText('Out of Scope', 'HEADING_2');
    if (prd.outOfScope.length > 0) {
      addBulletList(prd.outOfScope.map(s => s.rationale ? `${s.item} - ${s.rationale}` : s.item));
    } else {
      addText('No items explicitly excluded.');
    }
    addText('');

    // Assumptions Section
    addText('Assumptions', 'HEADING_2');
    if (prd.assumptions.length > 0) {
      addBulletList(prd.assumptions.map(a =>
        `[${a.risk.toUpperCase()}] ${a.assumption}${a.mitigation ? ` (Mitigation: ${a.mitigation})` : ''}`
      ));
    } else {
      addText('No assumptions documented.');
    }
    addText('');

    // Brand & UX Constraints Section
    addText('Brand & UX Constraints', 'HEADING_2');
    addText(`Brand: ${prd.brandContext.brandName} (Guidelines ${prd.brandContext.guidelinesVersion})`);
    if (prd.brandContext.uiConstraints.length > 0) {
      addBulletList(prd.brandContext.uiConstraints);
    }
    addText('');

    // Functional Modules Section
    addText('Functional Modules', 'HEADING_2');

    for (const module of prd.modules) {
      addText(`Module: ${module.moduleName}`, 'HEADING_3');
      addText(module.description);
      addText('');

      for (const feature of module.features) {
        addText(`Feature: ${feature.featureName} [${feature.priority}]`, 'HEADING_3');
        addText(feature.description);
        addText('');

        // User Flows
        for (const flow of feature.userFlows) {
          addText(`Flow: ${flow.flowName}`);
          addText(flow.description);

          const steps = flow.steps.map(s =>
            `${s.stepNumber}. ${s.action} → ${s.expectedResult}`
          );
          for (const step of steps) {
            requests.push({
              insertText: {
                location: { index: currentIndex },
                text: step + '\n',
              },
            });
            currentIndex += step.length + 1;
          }
          addText('');
        }

        // Edge Cases
        if (feature.edgeCases && feature.edgeCases.length > 0) {
          addText('Edge Cases:');
          addBulletList(feature.edgeCases.map(e =>
            `[${e.priority}] ${e.scenario}: ${e.expectedBehavior}`
          ));
        }

        // Success Metrics
        if (feature.successMetrics && feature.successMetrics.length > 0) {
          addText('Success Metrics:');
          addBulletList(feature.successMetrics.map(m =>
            `${m.metric}: ${m.target} (${m.measurementMethod})`
          ));
        }
        addText('');
      }
    }

    // Success Metrics Section (Global)
    if (prd.globalSuccessMetrics && prd.globalSuccessMetrics.length > 0) {
      addText('Global Success Metrics', 'HEADING_2');
      addBulletList(prd.globalSuccessMetrics.map(m =>
        `${m.metric}: ${m.target} (${m.measurementMethod})`
      ));
      addText('');
    }

    // Technical Notes Section
    if (prd.technicalNotes) {
      addText('Technical Notes', 'HEADING_2');

      if (prd.technicalNotes.integrations?.length) {
        addText('Integrations:');
        addBulletList(prd.technicalNotes.integrations);
      }

      if (prd.technicalNotes.constraints?.length) {
        addText('Constraints:');
        addBulletList(prd.technicalNotes.constraints);
      }

      if (prd.technicalNotes.securityConsiderations?.length) {
        addText('Security Considerations:');
        addBulletList(prd.technicalNotes.securityConsiderations);
      }

      if (prd.technicalNotes.performanceRequirements?.length) {
        addText('Performance Requirements:');
        addBulletList(prd.technicalNotes.performanceRequirements);
      }
      addText('');
    }

    // Version History Section
    addText('Version History', 'HEADING_2');
    for (const entry of prd.versionHistory) {
      addText(`${entry.version} - ${entry.date.split('T')[0]} - ${entry.changedBy}`);
      addText(entry.summary);
      if (entry.details && entry.details.length > 0) {
        addBulletList(entry.details);
      }
      addText('');
    }

    return requests;
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(documentId: string): Promise<{
    title: string;
    lastModified?: string;
    revisionId?: string;
  }> {
    const authService = getGoogleAuthService();
    const drive = await authService.getDriveClient();

    const response = await drive.files.get({
      fileId: documentId,
      fields: 'name,modifiedTime,headRevisionId',
    });

    return {
      title: response.data.name || 'Unknown',
      lastModified: response.data.modifiedTime || undefined,
      revisionId: response.data.headRevisionId || undefined,
    };
  }

  /**
   * Share document with users
   */
  async shareDocument(
    documentId: string,
    emails: string[],
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<void> {
    const authService = getGoogleAuthService();
    const drive = await authService.getDriveClient();

    for (const email of emails) {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
      });
    }
  }
}

// Singleton instance
let docsServiceInstance: GoogleDocsService | null = null;

export function getGoogleDocsService(config?: GoogleDocsConfig): GoogleDocsService {
  if (!docsServiceInstance) {
    docsServiceInstance = new GoogleDocsService(config);
  }
  return docsServiceInstance;
}

export function resetGoogleDocsService(): void {
  docsServiceInstance = null;
}
