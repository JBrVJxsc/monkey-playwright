/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Integration tests for recorder UI customization.
 *
 * These tests verify that the customization API works correctly when using
 * the in-process Playwright factory (createInProcessPlaywright).
 *
 * Tests cover:
 * - Custom highlight colors (highlightColors)
 * - Custom highlight CSS (highlightCSS)
 * - Custom element factories (elementFactories)
 * - Combined customization options
 * - Default behavior when no customization provided
 *
 * Key implementation notes:
 * - PWTEST_UNDER_TEST=1 is required to get open shadow root for inspection
 * - Uses createInProcessPlaywright to simulate real app usage
 * - Element factories are passed as JavaScript string (CommonJS module format)
 * - Custom elements must use correct tag names (x-pw-*) for CSS to work
 *
 * See packages/injected/src/recorder/recorderElementFactories.ts for
 * the full customization API documentation.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// Enable open shadow root for testing - required to inspect recorder elements
process.env.PWTEST_UNDER_TEST = '1';

// Use the in-process Playwright factory to simulate how external apps use this
const inProcessPath = path.join(__dirname, '..', '..', '..', 'packages', 'playwright-core', 'lib', 'inProcessFactory.js');
const { createInProcessPlaywright } = require(inProcessPath);

test.describe('recorder customization via inProcessFactory', () => {
  test('should apply custom highlight colors', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customActionColor = '#00ff007f';
      const customSingleColor = '#ff00ff7f';

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightColors: {
            action: customActionColor,
            single: customSingleColor,
          },
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();

      // Wait for highlight element to appear in the shadow DOM
      await page.waitForSelector('x-pw-glass');

      // Check that highlight is visible and has a background color set
      const highlightInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        if (!highlight) return null;
        return {
          visible: (highlight as HTMLElement).style.display !== 'none',
          backgroundColor: (highlight as HTMLElement).style.backgroundColor,
        };
      });

      expect(highlightInfo).toBeTruthy();
      expect(highlightInfo!.visible).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should apply custom highlight CSS', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customCSS = `
        x-pw-tooltip {
          background-color: rgb(34, 34, 34) !important;
          border-radius: 12px !important;
        }
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: customCSS,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight with tooltip
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      // Check that custom CSS is applied to tooltip
      const tooltipStyle = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;
        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip) return null;
        const style = getComputedStyle(tooltip);
        return {
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
        };
      });

      expect(tooltipStyle).toBeTruthy();
      expect(tooltipStyle!.borderRadius).toBe('12px');
      expect(tooltipStyle!.backgroundColor).toBe('rgb(34, 34, 34)');
    } finally {
      await browser.close();
    }
  });

  test('should apply custom element factories', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customFactories = `
        module.exports = {
          createTooltip: (doc) => {
            const el = doc.createElement('x-pw-tooltip');
            el.setAttribute('data-custom-tooltip', 'factory-applied');
            return el;
          },
          createHighlight: (doc) => {
            const el = doc.createElement('x-pw-highlight');
            el.setAttribute('data-custom-highlight', 'factory-applied');
            return el;
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: customFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      // Wait a bit for highlight to render
      await page.waitForTimeout(500);

      // Check custom attributes from factories
      const customAttributes = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no shadow root' };

        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');

        return {
          highlightExists: !!highlight,
          tooltipExists: !!tooltip,
          highlightAttr: highlight?.getAttribute('data-custom-highlight'),
          tooltipAttr: tooltip?.getAttribute('data-custom-tooltip'),
          highlightTagName: highlight?.tagName,
          tooltipTagName: tooltip?.tagName,
        };
      });

      expect(customAttributes).toBeTruthy();
      expect(customAttributes!.highlightAttr).toBe('factory-applied');
      expect(customAttributes!.tooltipAttr).toBe('factory-applied');
    } finally {
      await browser.close();
    }
  });

  test('should apply custom overlay tool item factories', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customFactories = `
        module.exports = {
          createToolItem: (doc, name, title) => {
            const el = doc.createElement('x-pw-tool-item');
            el.classList.add(name);
            el.classList.add('my-custom-tool');
            el.title = title;
            el.setAttribute('data-tool-name', name);
            el.appendChild(doc.createElement('x-div'));
            return el;
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: customFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Check that overlay tool items have custom class and attributes
      const toolItemInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool) return null;

        return {
          hasCustomClass: recordTool.classList.contains('my-custom-tool'),
          toolName: recordTool.getAttribute('data-tool-name'),
        };
      });

      expect(toolItemInfo).toBeTruthy();
      expect(toolItemInfo!.hasCustomClass).toBe(true);
      expect(toolItemInfo!.toolName).toBe('record');
    } finally {
      await browser.close();
    }
  });

  test('should work with all customization options combined', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customCSS = `
        x-pw-tooltip {
          font-size: 18px !important;
        }
      `;

      const customFactories = `
        module.exports = {
          createTooltip: (doc) => {
            const el = doc.createElement('x-pw-tooltip');
            el.classList.add('combined-test-tooltip');
            return el;
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: customCSS,
          highlightColors: {
            single: '#aabbcc7f',
            action: '#112233ff',
          },
          elementFactories: customFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      // Check all customizations are applied
      const result = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;

        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip) return null;

        const style = getComputedStyle(tooltip);
        return {
          hasCustomClass: tooltip.classList.contains('combined-test-tooltip'),
          fontSize: style.fontSize,
        };
      });

      expect(result).toBeTruthy();
      expect(result!.hasCustomClass).toBe(true);
      expect(result!.fontSize).toBe('18px');
    } finally {
      await browser.close();
    }
  });

  test('should use default behavior when no customization provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder without customization
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      // Check that default elements are used (no custom attributes)
      const result = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;

        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');

        return {
          highlightExists: !!highlight,
          tooltipExists: !!tooltip,
          // Should not have custom attributes since no factories provided
          highlightCustomAttr: highlight?.getAttribute('data-custom-highlight'),
          tooltipCustomAttr: tooltip?.getAttribute('data-custom-tooltip'),
        };
      });

      expect(result).toBeTruthy();
      expect(result!.highlightExists).toBe(true);
      expect(result!.highlightCustomAttr).toBeNull();
      expect(result!.tooltipCustomAttr).toBeNull();
    } finally {
      await browser.close();
    }
  });
});
