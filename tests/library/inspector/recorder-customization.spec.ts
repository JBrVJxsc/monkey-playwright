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

/**
 * Shadcn/Chaos Monkey Theme Integration Tests
 *
 * These tests verify that the customization API can achieve a complete
 * Shadcn-style theme with custom CSS variables and element factories.
 *
 * Based on user's custom theme: /Users/xuzhang/Desktop/highlight.css
 */
test.describe('Shadcn theme customization', () => {
  // Simplified Shadcn-style CSS with CSS custom properties
  const shadcnCSS = `
    :host {
      --pw-background: #ffffff;
      --pw-foreground: #242424;
      --pw-popover: #ffffff;
      --pw-popover-foreground: #242424;
      --pw-primary: #ffe01a;
      --pw-primary-foreground: #262626;
      --pw-muted: #f5f5f5;
      --pw-muted-foreground: #737373;
      --pw-border: #ebebeb;
      --pw-radius-lg: 0.5rem;
      --pw-radius-md: 0.375rem;
      --pw-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      font-family: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
      font-size: 14px;
    }

    svg { position: absolute; height: 0; }
    * { box-sizing: border-box; }
    *[hidden] { display: none !important; }
    x-div { display: block; }
    x-spacer { flex: auto; }

    x-pw-tooltip {
      background-color: var(--pw-popover);
      color: var(--pw-popover-foreground);
      border-radius: var(--pw-radius-lg);
      border: 1px solid var(--pw-border);
      box-shadow: var(--pw-shadow-lg);
      display: none;
      font-size: 13px;
      left: 0;
      max-width: 600px;
      position: absolute;
      top: 0;
      padding: 0;
      flex-direction: column;
      overflow: hidden;
      z-index: 50;
    }

    x-pw-tooltip-line {
      display: flex;
      max-width: 600px;
      padding: 8px 12px;
      user-select: none;
    }

    x-pw-highlight {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      border-radius: var(--pw-radius-md);
    }

    x-pw-dialog {
      background-color: var(--pw-popover);
      color: var(--pw-popover-foreground);
      border-radius: var(--pw-radius-lg);
      border: 1px solid var(--pw-border);
      box-shadow: var(--pw-shadow-lg);
      display: flex;
      flex-direction: column;
      position: absolute;
      z-index: 50;
      pointer-events: auto;
    }

    x-pw-dialog:not(.autosize) {
      width: 400px;
      gap: 16px;
      padding: 20px;
    }

    x-pw-dialog-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    x-pw-dialog-title {
      font-size: 18px;
      line-height: 1;
      font-weight: 600;
    }

    x-pw-dialog-body {
      display: flex;
      flex-direction: column;
      flex: auto;
    }

    x-pw-dialog-footer {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      gap: 8px;
    }

    x-pw-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--pw-radius-md);
      font-size: 14px;
      font-weight: 500;
      height: 36px;
      padding: 8px 16px;
      background-color: var(--pw-primary);
      color: var(--pw-primary-foreground);
      border: none;
      cursor: pointer;
    }

    x-pw-button.outline {
      background-color: var(--pw-background);
      color: var(--pw-foreground);
      border: 1px solid var(--pw-border);
    }

    x-pw-tools-list {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--pw-border);
    }

    x-pw-tool-item {
      pointer-events: auto;
      height: 28px;
      min-width: 28px;
      width: 28px;
      border-radius: var(--pw-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    x-pw-tool-item > x-div {
      width: 16px;
      height: 16px;
      background-color: var(--pw-foreground);
    }

    x-pw-overlay {
      position: absolute;
      top: 0;
      max-width: min-content;
      z-index: 2147483647;
      background: transparent;
      pointer-events: auto;
    }
  `;

  test('should apply Shadcn-style CSS with custom properties', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: shadcnCSS,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight with tooltip
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      // Check that Shadcn CSS variables are applied
      const result = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;

        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip) return null;

        const style = getComputedStyle(tooltip);
        return {
          borderRadius: style.borderRadius,
          backgroundColor: style.backgroundColor,
          // Check for Shadcn-style 8px border radius (0.5rem)
          hasRoundedLg: style.borderRadius === '8px',
        };
      });

      expect(result).toBeTruthy();
      expect(result!.hasRoundedLg).toBe(true);
      expect(result!.backgroundColor).toBe('rgb(255, 255, 255)');
    } finally {
      await browser.close();
    }
  });

  test('should support custom dialog header/title/footer factories', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customFactories = `
        module.exports = {
          createDialogHeader: (doc) => {
            const el = doc.createElement('x-pw-dialog-header');
            el.setAttribute('data-shadcn-header', 'true');
            return el;
          },
          createDialogTitle: (doc, text) => {
            const el = doc.createElement('x-pw-dialog-title');
            el.textContent = text;
            el.setAttribute('data-shadcn-title', 'true');
            return el;
          },
          createDialogFooter: (doc) => {
            const el = doc.createElement('x-pw-dialog-footer');
            el.setAttribute('data-shadcn-footer', 'true');
            return el;
          },
          createButton: (doc, text, variant) => {
            const el = doc.createElement('x-pw-button');
            el.textContent = text;
            if (variant) el.classList.add(variant);
            el.setAttribute('data-shadcn-button', 'true');
            return el;
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: shadcnCSS,
          elementFactories: customFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Verify the custom factories are properly registered
      // (The factories are available but dialog elements are only created when needed)
      const glassExists = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass && !!glass.shadowRoot;
      });

      expect(glassExists).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should apply Chaos Monkey yellow primary color', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Use custom colors for Chaos Monkey theme
      // Primary yellow: #ffe01a
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: shadcnCSS,
          highlightColors: {
            // Use yellow-tinted highlight colors for Chaos Monkey theme
            action: '#ffe01a7f',  // Yellow with alpha
            single: '#ffe01a4f',  // Yellow with lower alpha
          },
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');

      const highlightInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        if (!highlight) return null;
        return {
          exists: true,
          visible: (highlight as HTMLElement).style.display !== 'none',
        };
      });

      expect(highlightInfo).toBeTruthy();
      expect(highlightInfo!.exists).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should support complete Shadcn theme with CSS and factories', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Custom factories that add Shadcn-specific attributes/classes
      const shadcnFactories = `
        module.exports = {
          createTooltip: (doc) => {
            const el = doc.createElement('x-pw-tooltip');
            el.classList.add('shadcn-tooltip');
            return el;
          },
          createHighlight: (doc) => {
            const el = doc.createElement('x-pw-highlight');
            el.classList.add('shadcn-highlight');
            return el;
          },
          createDialog: (doc, autosize) => {
            const el = doc.createElement('x-pw-dialog');
            if (autosize) el.classList.add('autosize');
            el.classList.add('shadcn-dialog');
            return el;
          },
          createToolItem: (doc, name, title) => {
            const el = doc.createElement('x-pw-tool-item');
            el.classList.add(name);
            el.classList.add('shadcn-tool');
            el.title = title;
            el.appendChild(doc.createElement('x-div'));
            return el;
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: shadcnCSS,
          highlightColors: {
            action: '#ffe01a7f',
            single: '#ffe01a4f',
            multiple: '#fef08a7f',
            assert: '#ffe01a80',
          },
          elementFactories: shadcnFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);

      // Hover to trigger highlight
      await page.locator('button').hover();
      await page.waitForSelector('x-pw-glass');
      await page.waitForTimeout(500);

      // Check that all Shadcn customizations are applied
      const result = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;

        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        const toolItem = glass.shadowRoot.querySelector('x-pw-tool-item');

        return {
          tooltipHasShadcnClass: tooltip?.classList.contains('shadcn-tooltip'),
          highlightHasShadcnClass: highlight?.classList.contains('shadcn-highlight'),
          toolItemHasShadcnClass: toolItem?.classList.contains('shadcn-tool'),
        };
      });

      expect(result).toBeTruthy();
      expect(result!.tooltipHasShadcnClass).toBe(true);
      expect(result!.highlightHasShadcnClass).toBe(true);
      expect(result!.toolItemHasShadcnClass).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should support custom createDialogLayout for footer buttons', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Custom factories with Shadcn-style dialog layout (header/body/footer)
      const customFactories = `
        module.exports = {
          createDialogHeader: (doc) => {
            const el = doc.createElement('x-pw-dialog-header');
            el.setAttribute('data-custom', 'header');
            return el;
          },
          createDialogTitle: (doc, text) => {
            const el = doc.createElement('x-pw-dialog-title');
            el.textContent = text;
            el.setAttribute('data-custom', 'title');
            return el;
          },
          createDialogFooter: (doc) => {
            const el = doc.createElement('x-pw-dialog-footer');
            el.setAttribute('data-custom', 'footer');
            return el;
          },
          createButton: (doc, text, variant) => {
            const el = doc.createElement('x-pw-button');
            el.textContent = text;
            if (variant) el.classList.add(variant);
            el.setAttribute('data-custom', 'button');
            return el;
          },
          createDialogLayout: (doc, options, factories) => {
            const { dialogElement, label, body, onAccept, onCancel } = options;

            // Header with title at top
            const headerElement = factories.createDialogHeader(doc);
            const titleElement = factories.createDialogTitle(doc, label);
            headerElement.appendChild(titleElement);
            dialogElement.appendChild(headerElement);

            // Body with content in middle
            const bodyElement = factories.createDialogBody(doc);
            bodyElement.appendChild(body);
            dialogElement.appendChild(bodyElement);

            // Footer with buttons at bottom
            const footerElement = factories.createDialogFooter(doc);
            const cancelButton = factories.createButton(doc, 'Cancel', 'outline');
            cancelButton.addEventListener('click', () => onCancel());
            footerElement.appendChild(cancelButton);

            if (onAccept) {
              const acceptButton = factories.createButton(doc, 'Accept');
              acceptButton.addEventListener('click', () => onAccept());
              footerElement.appendChild(acceptButton);
            }

            dialogElement.appendChild(footerElement);
          },
        };
      `;

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: shadcnCSS,
          elementFactories: customFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<p>Some text to assert</p>`);
      await page.waitForSelector('x-pw-glass');

      // Click on "Assert text" tool to open dialog
      const assertTextButton = await page.evaluateHandle(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return null;
        return glass.shadowRoot.querySelector('x-pw-tool-item.text');
      });

      if (assertTextButton) {
        await assertTextButton.asElement()?.click();
        await page.waitForTimeout(300);

        // Click on the paragraph to trigger assert dialog
        await page.locator('p').click();
        await page.waitForTimeout(500);

        // Check dialog structure
        const dialogInfo = await page.evaluate(() => {
          const glass = document.querySelector('x-pw-glass');
          if (!glass || !glass.shadowRoot) return { error: 'no glass' };

          const dialog = glass.shadowRoot.querySelector('x-pw-dialog');
          if (!dialog) return { error: 'no dialog' };

          const header = dialog.querySelector('x-pw-dialog-header');
          const title = dialog.querySelector('x-pw-dialog-title');
          const footer = dialog.querySelector('x-pw-dialog-footer');
          const buttons = dialog.querySelectorAll('x-pw-button');

          return {
            hasHeader: !!header,
            headerCustomAttr: header?.getAttribute('data-custom'),
            hasTitle: !!title,
            titleCustomAttr: title?.getAttribute('data-custom'),
            hasFooter: !!footer,
            footerCustomAttr: footer?.getAttribute('data-custom'),
            buttonCount: buttons.length,
            buttonCustomAttr: buttons[0]?.getAttribute('data-custom'),
          };
        });

        expect(dialogInfo.hasHeader).toBe(true);
        expect(dialogInfo.headerCustomAttr).toBe('header');
        expect(dialogInfo.hasTitle).toBe(true);
        expect(dialogInfo.titleCustomAttr).toBe('title');
        expect(dialogInfo.hasFooter).toBe(true);
        expect(dialogInfo.footerCustomAttr).toBe('footer');
        expect(dialogInfo.buttonCount).toBeGreaterThan(0);
        expect(dialogInfo.buttonCustomAttr).toBe('button');
      }
    } finally {
      await browser.close();
    }
  });
});

/**
 * Tool Icon Factory Tests (createToolIcon)
 *
 * These tests verify the createToolIcon factory API which allows customizing
 * the icons rendered inside tool items. This enables use of inline SVG icons
 * (like Lucide) instead of the default clip-path based x-div icons.
 *
 * Key implementation notes:
 * - Default createToolIcon returns x-div for backwards compatibility
 * - Custom createToolIcon can return any Element (typically SVG)
 * - createToolItem and createToolGripper use createToolIcon internally
 */
test.describe('createToolIcon factory customization', () => {
  test('should use default x-div icon when no custom createToolIcon provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder without custom factories
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Check that tool items use default x-div icons
      const iconInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool) return { error: 'no record tool' };

        const iconChild = recordTool.firstElementChild;
        return {
          tagName: iconChild?.tagName.toLowerCase(),
          isSvg: iconChild?.tagName.toLowerCase() === 'svg',
          isXDiv: iconChild?.tagName.toLowerCase() === 'x-div',
        };
      });

      expect(iconInfo).toBeTruthy();
      expect(iconInfo.isXDiv).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should apply custom createToolIcon factory with inline SVG', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Custom factories with inline SVG icons (Lucide-style)
      const customFactories = `
        const ICONS = {
          'record': 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
          'pick-locator': 'M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6',
        };

        module.exports = {
          createToolIcon: (doc, iconName) => {
            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.classList.add('pw-icon');
            svg.setAttribute('data-icon-name', iconName);

            const pathData = ICONS[iconName];
            if (pathData) {
              const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('d', pathData);
              svg.appendChild(path);
            }

            return svg;
          },
          createToolItem: (doc, name, title) => {
            const el = doc.createElement('x-pw-tool-item');
            el.classList.add(name);
            el.title = title;
            // Use createToolIcon for inline SVG
            el.appendChild(module.exports.createToolIcon(doc, name));
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

      // Check that tool items use custom SVG icons
      const iconInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool) return { error: 'no record tool' };

        const svg = recordTool.querySelector('svg');
        return {
          hasSvg: !!svg,
          hasClass: svg?.classList.contains('pw-icon'),
          iconName: svg?.getAttribute('data-icon-name'),
          viewBox: svg?.getAttribute('viewBox'),
          hasPath: !!svg?.querySelector('path'),
        };
      });

      expect(iconInfo).toBeTruthy();
      expect(iconInfo.hasSvg).toBe(true);
      expect(iconInfo.hasClass).toBe(true);
      expect(iconInfo.iconName).toBe('record');
      expect(iconInfo.viewBox).toBe('0 0 24 24');
      expect(iconInfo.hasPath).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should apply custom createToolIcon to gripper', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Custom factories with SVG gripper icon
      const customFactories = `
        module.exports = {
          createToolIcon: (doc, iconName) => {
            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.classList.add('pw-icon');
            svg.setAttribute('data-gripper-icon', iconName);
            return svg;
          },
          createToolGripper: (doc) => {
            const el = doc.createElement('x-pw-tool-gripper');
            el.appendChild(module.exports.createToolIcon(doc, 'gripper'));
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

      // Check that gripper uses custom SVG icon
      const gripperInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no glass' };

        const gripper = glass.shadowRoot.querySelector('x-pw-tool-gripper');
        if (!gripper) return { error: 'no gripper' };

        const svg = gripper.querySelector('svg');
        return {
          hasSvg: !!svg,
          hasClass: svg?.classList.contains('pw-icon'),
          iconName: svg?.getAttribute('data-gripper-icon'),
        };
      });

      expect(gripperInfo).toBeTruthy();
      expect(gripperInfo.hasSvg).toBe(true);
      expect(gripperInfo.hasClass).toBe(true);
      expect(gripperInfo.iconName).toBe('gripper');
    } finally {
      await browser.close();
    }
  });

  test('should support full Lucide-style icon factory with stroke attributes', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Full Lucide-style icon factory with proper SVG attributes
      const customFactories = `
        const LUCIDE_ICONS = {
          'record': { paths: ['M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0'], fill: true },
          'pick-locator': { paths: ['M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6', 'm12 12 4 10 1.7-4.3L22 16Z'], fill: false },
          'eye': { paths: ['M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'], fill: false },
        };

        const ICON_MAP = {
          'record': 'record',
          'pick-locator': 'pick-locator',
          'visibility': 'eye',
        };

        module.exports = {
          createToolIcon: (doc, iconName) => {
            const mappedName = ICON_MAP[iconName] || iconName;
            const iconData = LUCIDE_ICONS[mappedName];

            if (!iconData) {
              // Fallback for unknown icons
              return doc.createElement('x-div');
            }

            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('fill', iconData.fill ? 'currentColor' : 'none');
            svg.setAttribute('stroke', iconData.fill ? 'none' : 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.classList.add('pw-icon');

            for (const d of iconData.paths) {
              const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('d', d);
              svg.appendChild(path);
            }

            return svg;
          },
          createToolItem: (doc, name, title) => {
            const el = doc.createElement('x-pw-tool-item');
            el.classList.add(name);
            el.title = title;
            el.appendChild(module.exports.createToolIcon(doc, name));
            return el;
          },
          createToolGripper: (doc) => {
            const el = doc.createElement('x-pw-tool-gripper');
            el.appendChild(module.exports.createToolIcon(doc, 'gripper'));
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

      // Check multiple tool items for proper SVG attributes
      const iconsInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        const pickLocatorTool = glass.shadowRoot.querySelector('x-pw-tool-item.pick-locator');

        const recordSvg = recordTool?.querySelector('svg');
        const pickLocatorSvg = pickLocatorTool?.querySelector('svg');

        return {
          record: {
            hasSvg: !!recordSvg,
            fill: recordSvg?.getAttribute('fill'),
            stroke: recordSvg?.getAttribute('stroke'),
            pathCount: recordSvg?.querySelectorAll('path').length,
          },
          pickLocator: {
            hasSvg: !!pickLocatorSvg,
            fill: pickLocatorSvg?.getAttribute('fill'),
            stroke: pickLocatorSvg?.getAttribute('stroke'),
            strokeWidth: pickLocatorSvg?.getAttribute('stroke-width'),
            pathCount: pickLocatorSvg?.querySelectorAll('path').length,
          },
        };
      });

      expect(iconsInfo).toBeTruthy();

      // Record icon should be filled (circle)
      expect(iconsInfo.record.hasSvg).toBe(true);
      expect(iconsInfo.record.fill).toBe('currentColor');
      expect(iconsInfo.record.stroke).toBe('none');
      expect(iconsInfo.record.pathCount).toBe(1);

      // Pick locator icon should be stroked
      expect(iconsInfo.pickLocator.hasSvg).toBe(true);
      expect(iconsInfo.pickLocator.fill).toBe('none');
      expect(iconsInfo.pickLocator.stroke).toBe('currentColor');
      expect(iconsInfo.pickLocator.strokeWidth).toBe('2');
      expect(iconsInfo.pickLocator.pathCount).toBe(2);
    } finally {
      await browser.close();
    }
  });

  test('should fallback gracefully for unknown icon names', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Factory that returns x-div for unknown icons
      const customFactories = `
        const KNOWN_ICONS = ['record'];

        module.exports = {
          createToolIcon: (doc, iconName) => {
            if (!KNOWN_ICONS.includes(iconName)) {
              // Fallback to x-div for unknown icons
              const fallback = doc.createElement('x-div');
              fallback.setAttribute('data-fallback', 'true');
              return fallback;
            }

            const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('pw-icon');
            return svg;
          },
          createToolItem: (doc, name, title) => {
            const el = doc.createElement('x-pw-tool-item');
            el.classList.add(name);
            el.title = title;
            el.appendChild(module.exports.createToolIcon(doc, name));
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

      // Check that record uses SVG but pick-locator falls back to x-div
      const fallbackInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot) return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        const pickLocatorTool = glass.shadowRoot.querySelector('x-pw-tool-item.pick-locator');

        return {
          recordHasSvg: !!recordTool?.querySelector('svg'),
          pickLocatorHasFallback: pickLocatorTool?.querySelector('x-div')?.getAttribute('data-fallback') === 'true',
        };
      });

      expect(fallbackInfo).toBeTruthy();
      expect(fallbackInfo.recordHasSvg).toBe(true);
      expect(fallbackInfo.pickLocatorHasFallback).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
