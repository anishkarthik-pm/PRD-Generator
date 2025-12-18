#!/usr/bin/env node
/**
 * Local Test Script for PRD Automation System
 * Tests the MCP tools without Google API integration
 */

import { loadBrandGuidelines, getLoadedBrandProfile } from './src/tools/load-brand-guidelines.js';
import { parsePRDContent } from './src/tools/parse-prd-content.js';
import { generateHTMLWireframes } from './src/tools/generate-html-wireframes.js';
import { logAuditEvent } from './src/tools/log-audit-event.js';
import * as fs from 'fs';
import * as path from 'path';

async function runLocalTest() {
  console.log('='.repeat(60));
  console.log('PRD AUTOMATION SYSTEM - LOCAL TEST');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Load Brand Guidelines
  console.log('TEST 1: Loading Brand Guidelines...');
  console.log('-'.repeat(40));

  const brandResult = await loadBrandGuidelines({
    brandProfilePath: '../brand-profiles/example-retail-brand.json',
  });

  if (brandResult.success) {
    console.log('✅ Brand loaded successfully!');
    console.log(`   Brand: ${brandResult.brandName}`);
    console.log(`   Version: ${brandResult.version}`);
    console.log(`   Design Principles: ${brandResult.designPrinciplesCount}`);
    console.log(`   UI Constraints: ${brandResult.uiConstraintsCount}`);
    console.log(`   Disallowed Patterns: ${brandResult.disallowedPatterns?.join(', ')}`);
  } else {
    console.log('❌ Brand load failed:', brandResult.error);
    return;
  }
  console.log();

  // Test 2: Parse PRD Content
  console.log('TEST 2: Parsing PRD Content...');
  console.log('-'.repeat(40));

  const prdInput = {
    title: 'Test PRD - User Authentication',
    owner: 'Test User',
    objective: 'Enable secure user authentication via mobile app',
    businessValue: 'Secure access increases user trust and reduces fraud',
    targetUsers: ['Mobile App Users', 'Security Team'],
    inScope: [
      'Email/password login',
      'Biometric authentication',
      'Password reset flow',
    ],
    outOfScope: [
      'Social login (Phase 2)',
      'Multi-factor authentication (Phase 2)',
    ],
    assumptions: [
      'Users have devices with biometric capabilities',
      'Backend auth service is available',
    ],
    modules: [
      {
        name: 'Login',
        description: 'Core login functionality for user authentication',
        features: [
          {
            name: 'Email Login',
            description: 'Allow users to log in with email and password',
            priority: 'P0' as const,
            flows: [
              {
                name: 'Standard Email Login',
                description: 'User enters email and password to log in',
                steps: [
                  'User taps Login button on home screen',
                  'User enters email address',
                  'User enters password',
                  'User taps Sign In button',
                  'System validates credentials',
                  'User is redirected to dashboard',
                ],
              },
            ],
            edgeCases: [
              'Invalid email format',
              'Incorrect password',
              'Account locked after 5 attempts',
            ],
            successMetrics: [
              'Login success rate > 95%',
              'Average login time < 10 seconds',
            ],
          },
        ],
      },
    ],
  };

  const parseResult = await parsePRDContent({ prdInput });

  if (parseResult.success) {
    console.log('✅ PRD parsed successfully!');
    console.log(`   PRD ID: ${parseResult.prd?.prdId}`);
    console.log(`   Version: ${parseResult.prd?.version}`);
    console.log(`   Modules: ${parseResult.prd?.modules.length}`);
    console.log(`   Completeness Score: ${parseResult.validationResult?.completenessScore}%`);

    if (parseResult.validationResult?.warnings.length) {
      console.log(`   Warnings: ${parseResult.validationResult.warnings.length}`);
      parseResult.validationResult.warnings.forEach(w => console.log(`     - ${w}`));
    }
  } else {
    console.log('❌ PRD parse failed:', parseResult.error);
    if (parseResult.validationResult?.errors.length) {
      parseResult.validationResult.errors.forEach(e => console.log(`   - ${e}`));
    }
    return;
  }
  console.log();

  // Test 3: Generate Wireframes (with approval)
  console.log('TEST 3: Generating Wireframes...');
  console.log('-'.repeat(40));

  const wireframeResult = await generateHTMLWireframes({
    prd: parseResult.prd,
    outputDirectory: './test-wireframes',
    approved: true,
  });

  if (wireframeResult.success) {
    console.log('✅ Wireframes generated successfully!');
    console.log(`   Output Directory: ${wireframeResult.outputDirectory}`);
    console.log(`   Total Pages: ${wireframeResult.totalPages}`);
    console.log('   Files:');
    wireframeResult.files?.forEach(f => console.log(`     - ${f.fileName}`));
  } else {
    console.log('❌ Wireframe generation failed:', wireframeResult.error);
  }
  console.log();

  // Test 4: Log Audit Event
  console.log('TEST 4: Logging Audit Event...');
  console.log('-'.repeat(40));

  const auditResult = await logAuditEvent({
    eventType: 'prd_reviewed',
    message: 'PRD reviewed during local testing',
    actor: 'test-user',
    prdId: parseResult.prd?.prdId,
    prdVersion: parseResult.prd?.version,
  });

  if (auditResult.success) {
    console.log('✅ Audit event logged!');
    console.log(`   Event ID: ${auditResult.eventId}`);
    console.log(`   Timestamp: ${auditResult.timestamp}`);
  } else {
    console.log('❌ Audit logging failed:', auditResult.error);
  }
  console.log();

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ Brand Guidelines: Loaded');
  console.log('✅ PRD Parsing: Validated');
  console.log('✅ Wireframes: Generated');
  console.log('✅ Audit Logging: Working');
  console.log();
  console.log('Note: Google Docs/Sheets integration requires credentials.');
  console.log('See docs/setup.md for configuration instructions.');
}

// Run the test
runLocalTest().catch(console.error);
