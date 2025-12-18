/**
 * Wireframe Generator Service
 * Generates low-fidelity HTML wireframes from PRD user flows.
 */

import { PRD, UserFlow, UserFlowStep, Feature } from '../schemas/prd.schema.js';
import { BrandProfile, getPrimaryColor } from '../schemas/brand-profile.schema.js';
import * as fs from 'fs';
import * as path from 'path';

export interface WireframeConfig {
  outputDirectory: string;
  includeNavigation: boolean;
  mobileFirst: boolean;
}

const DEFAULT_CONFIG: WireframeConfig = {
  outputDirectory: './wireframes',
  includeNavigation: true,
  mobileFirst: true,
};

export interface WireframeGenerationResult {
  outputDirectory: string;
  files: WireframeFile[];
  totalPages: number;
}

export interface WireframeFile {
  fileName: string;
  filePath: string;
  flowName: string;
  stepNumber: number;
  title: string;
}

export class WireframeGenerator {
  private config: WireframeConfig;

  constructor(config: Partial<WireframeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate wireframes for all flows in a PRD
   */
  async generateWireframes(
    prd: PRD,
    brandProfile: BrandProfile
  ): Promise<WireframeGenerationResult> {
    const outputDir = path.join(
      this.config.outputDirectory,
      prd.prdId,
      prd.version.replace('.', '-')
    );

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    const files: WireframeFile[] = [];

    // Generate index page
    const indexFile = this.generateIndexPage(prd, brandProfile, outputDir);
    files.push(indexFile);

    // Generate wireframes for each flow
    for (const module of prd.modules) {
      for (const feature of module.features) {
        for (const flow of feature.userFlows) {
          const flowFiles = this.generateFlowWireframes(
            prd,
            module.moduleName,
            feature,
            flow,
            brandProfile,
            outputDir
          );
          files.push(...flowFiles);
        }
      }
    }

    return {
      outputDirectory: outputDir,
      files,
      totalPages: files.length,
    };
  }

  /**
   * Generate index page listing all flows
   */
  private generateIndexPage(
    prd: PRD,
    brandProfile: BrandProfile,
    outputDir: string
  ): WireframeFile {
    const primaryColor = getPrimaryColor(brandProfile)?.hex || '#333333';

    let flowLinks = '';
    for (const module of prd.modules) {
      flowLinks += `<h3 style="margin-top: 24px; color: #666;">${module.moduleName}</h3>`;
      for (const feature of module.features) {
        for (const flow of feature.userFlows) {
          const flowSlug = this.slugify(flow.flowName);
          flowLinks += `
            <a href="${flowSlug}-step-1.html" class="flow-link">
              <span class="feature-badge">${feature.priority}</span>
              ${feature.featureName}: ${flow.flowName}
            </a>
          `;
        }
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${prd.title} - Wireframes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #333;
      line-height: 1.6;
      padding: 20px;
      max-width: 480px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: ${primaryColor};
    }
    .meta {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #333;
    }
    .flow-link {
      display: block;
      padding: 16px;
      margin-bottom: 8px;
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      text-decoration: none;
      color: #333;
      transition: background 0.2s;
    }
    .flow-link:hover {
      background: #f0f0f0;
    }
    .feature-badge {
      display: inline-block;
      padding: 2px 8px;
      background: ${primaryColor};
      color: white;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 8px;
    }
    .brand-note {
      margin-top: 32px;
      padding: 16px;
      background: #f0f4f8;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>${prd.title}</h1>
  <div class="meta">
    Version ${prd.version} | ${brandProfile.brandName} Brand Guidelines
  </div>

  <h2>User Flows</h2>
  ${flowLinks}

  <div class="brand-note">
    <strong>Brand:</strong> ${brandProfile.brandName}<br>
    <strong>Guidelines Version:</strong> ${brandProfile.version}<br>
    <strong>Mobile-First:</strong> ${brandProfile.platformConstraints?.mobileFirst ? 'Yes' : 'No'}
  </div>
</body>
</html>`;

    const fileName = 'index.html';
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, html);

    return {
      fileName,
      filePath,
      flowName: 'Index',
      stepNumber: 0,
      title: `${prd.title} - Wireframes Index`,
    };
  }

  /**
   * Generate wireframes for a single flow
   */
  private generateFlowWireframes(
    prd: PRD,
    moduleName: string,
    feature: Feature,
    flow: UserFlow,
    brandProfile: BrandProfile,
    outputDir: string
  ): WireframeFile[] {
    const files: WireframeFile[] = [];
    const flowSlug = this.slugify(flow.flowName);
    const primaryColor = getPrimaryColor(brandProfile)?.hex || '#333333';

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      const stepNumber = i + 1;
      const isLastStep = i === flow.steps.length - 1;
      const prevStep = i > 0 ? `${flowSlug}-step-${i}.html` : null;
      const nextStep = !isLastStep ? `${flowSlug}-step-${stepNumber + 1}.html` : null;

      const html = this.generateStepWireframe({
        prdTitle: prd.title,
        moduleName,
        featureName: feature.featureName,
        flowName: flow.flowName,
        step,
        stepNumber,
        totalSteps: flow.steps.length,
        prevStep,
        nextStep,
        primaryColor,
        brandName: brandProfile.brandName,
        mobileFirst: this.config.mobileFirst,
      });

      const fileName = `${flowSlug}-step-${stepNumber}.html`;
      const filePath = path.join(outputDir, fileName);
      fs.writeFileSync(filePath, html);

      files.push({
        fileName,
        filePath,
        flowName: flow.flowName,
        stepNumber,
        title: `Step ${stepNumber}: ${step.action}`,
      });
    }

    return files;
  }

  /**
   * Generate a single step wireframe
   */
  private generateStepWireframe(params: {
    prdTitle: string;
    moduleName: string;
    featureName: string;
    flowName: string;
    step: UserFlowStep;
    stepNumber: number;
    totalSteps: number;
    prevStep: string | null;
    nextStep: string | null;
    primaryColor: string;
    brandName: string;
    mobileFirst: boolean;
  }): string {
    const {
      prdTitle,
      moduleName,
      featureName,
      flowName,
      step,
      stepNumber,
      totalSteps,
      prevStep,
      nextStep,
      primaryColor,
      brandName,
      mobileFirst,
    } = params;

    // Generate UI element placeholder based on step action
    const uiElement = this.generateUIElementPlaceholder(step);

    const navigation = this.config.includeNavigation ? `
      <div class="nav-bar">
        ${prevStep ? `<a href="${prevStep}" class="nav-btn">← Back</a>` : '<span></span>'}
        <span class="step-indicator">Step ${stepNumber} of ${totalSteps}</span>
        ${nextStep ? `<a href="${nextStep}" class="nav-btn primary">Next →</a>` : '<span></span>'}
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowName} - Step ${stepNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #333;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      ${mobileFirst ? 'max-width: 480px; margin: 0 auto;' : ''}
    }

    /* Header */
    .header {
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: #fafafa;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 600;
      color: ${primaryColor};
    }
    .breadcrumb {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    /* Main Content */
    .content {
      flex: 1;
      padding: 24px 20px;
    }
    .step-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .step-description {
      color: #666;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    /* UI Element Placeholder */
    .ui-placeholder {
      background: #f5f5f5;
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .ui-placeholder-label {
      font-size: 14px;
      color: #888;
      font-style: italic;
    }
    .ui-placeholder-element {
      margin-top: 16px;
    }

    /* Wireframe Elements */
    .wf-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fff;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .wf-button {
      display: block;
      width: 100%;
      padding: 16px 24px;
      background: ${primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      min-height: 48px;
    }
    .wf-button.secondary {
      background: #f0f0f0;
      color: #333;
    }
    .wf-list-item {
      padding: 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .wf-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    /* Expected Result */
    .expected-result {
      background: #e8f5e9;
      border-left: 4px solid #4caf50;
      padding: 16px;
      margin-top: 24px;
      border-radius: 0 8px 8px 0;
    }
    .expected-result-label {
      font-size: 12px;
      font-weight: 600;
      color: #388e3c;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    /* Notes */
    .notes {
      margin-top: 16px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      font-size: 14px;
      color: #e65100;
    }

    /* Navigation */
    .nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-top: 1px solid #eee;
      background: #fafafa;
    }
    .nav-btn {
      padding: 12px 20px;
      background: #f0f0f0;
      color: #333;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      min-height: 44px;
      display: flex;
      align-items: center;
    }
    .nav-btn.primary {
      background: ${primaryColor};
      color: white;
    }
    .step-indicator {
      font-size: 14px;
      color: #888;
    }

    /* Footer */
    .footer {
      padding: 12px 20px;
      text-align: center;
      font-size: 11px;
      color: #aaa;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>${brandName}</h1>
    <div class="breadcrumb">${moduleName} → ${featureName} → ${flowName}</div>
  </header>

  <main class="content">
    <h2 class="step-title">Step ${stepNumber}: ${step.action}</h2>
    <p class="step-description">User Action</p>

    <div class="ui-placeholder">
      <div class="ui-placeholder-label">${step.uiElement || 'User Interface'}</div>
      <div class="ui-placeholder-element">
        ${uiElement}
      </div>
    </div>

    <div class="expected-result">
      <div class="expected-result-label">Expected Result</div>
      <div>${step.expectedResult}</div>
    </div>

    ${step.notes ? `<div class="notes">💡 ${step.notes}</div>` : ''}
  </main>

  ${navigation}

  <footer class="footer">
    ${prdTitle} Wireframes | Low-fidelity prototype
    <br>
    <a href="index.html">← Back to Index</a>
  </footer>
</body>
</html>`;
  }

  /**
   * Generate UI element placeholder based on action text
   */
  private generateUIElementPlaceholder(step: UserFlowStep): string {
    const action = step.action.toLowerCase();

    // Button actions
    if (action.includes('click') || action.includes('tap') || action.includes('press') || action.includes('submit')) {
      return '<button class="wf-button">Action Button</button>';
    }

    // Input actions
    if (action.includes('enter') || action.includes('type') || action.includes('input') || action.includes('fill')) {
      return `
        <input type="text" class="wf-input" placeholder="Enter value...">
        <button class="wf-button">Submit</button>
      `;
    }

    // Selection actions
    if (action.includes('select') || action.includes('choose') || action.includes('pick')) {
      return `
        <div class="wf-card">
          <div class="wf-list-item">Option A <span>○</span></div>
          <div class="wf-list-item">Option B <span>○</span></div>
          <div class="wf-list-item">Option C <span>○</span></div>
        </div>
      `;
    }

    // View/Display actions
    if (action.includes('view') || action.includes('see') || action.includes('display') || action.includes('show')) {
      return `
        <div class="wf-card">
          <div style="height: 80px; background: #f0f0f0; border-radius: 4px; margin-bottom: 8px;"></div>
          <div style="height: 16px; background: #e0e0e0; border-radius: 4px; width: 60%;"></div>
        </div>
      `;
    }

    // Scan actions
    if (action.includes('scan')) {
      return `
        <div class="wf-card" style="text-align: center; padding: 32px;">
          <div style="font-size: 48px; margin-bottom: 16px;">📷</div>
          <div style="color: #666;">Tap to scan</div>
        </div>
      `;
    }

    // Navigation actions
    if (action.includes('navigate') || action.includes('go to') || action.includes('open')) {
      return `
        <div class="wf-card">
          <div class="wf-list-item">Menu Item 1 <span>→</span></div>
          <div class="wf-list-item">Menu Item 2 <span>→</span></div>
          <div class="wf-list-item">Menu Item 3 <span>→</span></div>
        </div>
      `;
    }

    // Default placeholder
    return `
      <div class="wf-card" style="min-height: 120px; display: flex; align-items: center; justify-content: center;">
        <span style="color: #999;">[ Interactive Element ]</span>
      </div>
    `;
  }

  /**
   * Convert string to URL-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// Singleton instance
let wireframeGeneratorInstance: WireframeGenerator | null = null;

export function getWireframeGenerator(config?: Partial<WireframeConfig>): WireframeGenerator {
  if (!wireframeGeneratorInstance) {
    wireframeGeneratorInstance = new WireframeGenerator(config);
  }
  return wireframeGeneratorInstance;
}

export function resetWireframeGenerator(): void {
  wireframeGeneratorInstance = null;
}
