#!/usr/bin/env node
/**
 * Build script for playwright-browser-recorder
 *
 * Builds both the browser bundle (browserRecorder.js) and TypeScript types.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_ROOT = path.join(__dirname, '..');
const MONOREPO_ROOT = path.join(PACKAGE_ROOT, '..', '..');
const OUT_DIR = path.join(PACKAGE_ROOT, 'dist');

async function buildBrowserBundle() {
  const bundlePath = path.join(OUT_DIR, 'browserRecorder.js');
  const generateScript = path.join(MONOREPO_ROOT, 'utils', 'generate_injected.js');

  // Check if generate script exists (we're in the playwright repo)
  if (!fs.existsSync(generateScript)) {
    // Not in the playwright repo, check if bundle already exists
    if (fs.existsSync(bundlePath)) {
      console.log('   ✓ dist/browserRecorder.js (existing)');
      return;
    }
    throw new Error(
      'Cannot build browserRecorder.js: not in the playwright repo and no existing bundle found'
    );
  }

  console.log('   Building browser bundle...');
  execSync(`node "${generateScript}"`, { cwd: MONOREPO_ROOT, stdio: 'inherit' });
  console.log('   ✓ dist/browserRecorder.js');
}

async function build() {
  console.log('Building playwright-browser-recorder...\n');

  // Ensure output directory exists
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  // 1. Build browser bundle (browserRecorder.js)
  await buildBrowserBundle();

  // 2. Copy types.ts to dist as types.d.ts
  const typesSource = await fs.promises.readFile(path.join(PACKAGE_ROOT, 'src', 'types.ts'), 'utf-8');
  await fs.promises.writeFile(path.join(OUT_DIR, 'types.d.ts'), typesSource);
  console.log('   ✓ dist/types.d.ts');

  // 3. Generate index.d.ts
  const indexDtsContent = `/**
 * playwright-browser-recorder types
 */

export * from './types';
`;
  await fs.promises.writeFile(path.join(OUT_DIR, 'index.d.ts'), indexDtsContent);
  console.log('   ✓ dist/index.d.ts');

  // 4. Generate index.js (ESM exports for Vite compatibility)
  const indexJsContent = `/**
 * playwright-browser-recorder
 */

// Re-export type validation helpers
export const RECORDER_MODES = [
  'none',
  'recording',
  'inspecting',
  'standby',
  'recording-inspecting',
  'assertingText',
  'assertingVisibility',
  'assertingValue',
  'assertingSnapshot',
];

export function isValidRecorderMode(value) {
  return RECORDER_MODES.includes(value);
}
`;
  await fs.promises.writeFile(path.join(OUT_DIR, 'index.js'), indexJsContent);
  console.log('   ✓ dist/index.js');

  // 5. Generate browser.d.ts
  const browserDtsContent = `/**
 * Browser bundle types
 *
 * The actual bundle (browserRecorder.js) is built by utils/generate_injected.js
 */

import type { RecorderCallbacks } from './index';

export interface InjectedScriptOptions {
  isUnderTest?: boolean;
  sdkLanguage?: string;
  testIdAttributeName?: string;
  stableRafCount?: number;
  browserName?: string;
}

export interface InjectedScript {
  // Internal Playwright InjectedScript
}

export interface SimpleRecorder {
  setMode(mode: string): void;
  getMode(): string;
  destroy(): void;
}

export declare function createInjectedScript(
  window: Window,
  options?: InjectedScriptOptions
): InjectedScript;

export declare class SimpleRecorder {
  constructor(injectedScript: InjectedScript, callbacks?: RecorderCallbacks);
}

declare const PlaywrightRecorder: {
  InjectedScript: new (...args: any[]) => InjectedScript;
  SimpleRecorder: typeof SimpleRecorder;
  createInjectedScript: typeof createInjectedScript;
};

export default PlaywrightRecorder;
`;
  await fs.promises.writeFile(path.join(OUT_DIR, 'browser.d.ts'), browserDtsContent);
  console.log('   ✓ dist/browser.d.ts');

  console.log('\n✓ Build complete!\n');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
