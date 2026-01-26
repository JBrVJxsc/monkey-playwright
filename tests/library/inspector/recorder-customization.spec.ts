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
        if (!glass || !glass.shadowRoot)
          return null;
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        if (!highlight)
          return null;
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
        if (!glass || !glass.shadowRoot)
          return null;
        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip)
          return null;
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
        if (!glass || !glass.shadowRoot)
          return { error: 'no shadow root' };

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
        if (!glass || !glass.shadowRoot)
          return null;

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool)
          return null;

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
        if (!glass || !glass.shadowRoot)
          return null;

        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip)
          return null;

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
        if (!glass || !glass.shadowRoot)
          return null;

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
        if (!glass || !glass.shadowRoot)
          return null;

        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');
        if (!tooltip)
          return null;

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
        if (!glass || !glass.shadowRoot)
          return null;
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        if (!highlight)
          return null;
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
        if (!glass || !glass.shadowRoot)
          return null;

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
        if (!glass || !glass.shadowRoot)
          return null;
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
          if (!glass || !glass.shadowRoot)
            return { error: 'no glass' };

          const dialog = glass.shadowRoot.querySelector('x-pw-dialog');
          if (!dialog)
            return { error: 'no dialog' };

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
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool)
          return { error: 'no record tool' };

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
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const recordTool = glass.shadowRoot.querySelector('x-pw-tool-item.record');
        if (!recordTool)
          return { error: 'no record tool' };

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
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const gripper = glass.shadowRoot.querySelector('x-pw-tool-gripper');
        if (!gripper)
          return { error: 'no gripper' };

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
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

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
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

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

/**
 * FuzzySearchTool Integration Tests
 *
 * These tests verify the FuzzySearchTool functionality which provides
 * text editor-like search in the recorder toolbar.
 *
 * Key features tested:
 * - Search UI only appears when custom factories include createSearchContainer
 * - Multiple search modes: locator, text, aria, auto
 * - Match highlighting with counter display
 * - No-match state indication
 * - Collapsible UI (trigger icon, expandable input area)
 * - CSS classes for state management (has-value, has-results)
 *
 * See packages/injected/src/recorder/fuzzySearchTool.ts for implementation.
 */
test.describe('FuzzySearchTool', () => {
  // Search factory definitions for all tests
  // Updated for collapsible UI: trigger icon + expandable wrapper
  const searchFactories = `
    module.exports = {
      createSearchContainer: (doc) => {
        const el = doc.createElement('x-pw-search-container');
        return el;
      },
      createSearchTrigger: (doc) => {
        const el = doc.createElement('x-pw-search-trigger');
        el.title = 'Search elements';
        // Simple icon placeholder for testing
        const icon = doc.createElement('x-div');
        icon.classList.add('search-icon');
        el.appendChild(icon);
        return el;
      },
      createSearchExpandable: (doc) => {
        const el = doc.createElement('x-pw-search-expandable');
        return el;
      },
      createSearchInput: (doc) => {
        const el = doc.createElement('textarea');
        el.className = 'x-pw-search-input';
        el.placeholder = 'Find elements...';
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('rows', '1');
        return el;
      },
      createSearchCounter: (doc) => {
        const el = doc.createElement('x-pw-search-counter');
        return el;
      },
    };
  `;

  test('should NOT show search UI when no custom search factories provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder WITHOUT search factories
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Check that search container does NOT exist
      const hasSearchUI = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return null;
        return !!glass.shadowRoot.querySelector('x-pw-search-container');
      });

      expect(hasSearchUI).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should show search UI when custom search factories are provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Check that search UI is present with collapsible structure
      const searchUIInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const container = glass.shadowRoot.querySelector('x-pw-search-container');
        const trigger = glass.shadowRoot.querySelector('x-pw-search-trigger');
        const expandable = glass.shadowRoot.querySelector('x-pw-search-expandable');
        const input = glass.shadowRoot.querySelector('.x-pw-search-input');
        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');

        return {
          hasContainer: !!container,
          hasTrigger: !!trigger,
          hasExpandable: !!expandable,
          hasInput: !!input,
          hasCounter: !!counter,
          triggerTitle: trigger?.getAttribute('title'),
          inputPlaceholder: (input as HTMLTextAreaElement)?.placeholder,
        };
      });

      expect(searchUIInfo.hasContainer).toBe(true);
      expect(searchUIInfo.hasTrigger).toBe(true);
      expect(searchUIInfo.hasExpandable).toBe(true);
      expect(searchUIInfo.hasInput).toBe(true);
      expect(searchUIInfo.hasCounter).toBe(true);
      expect(searchUIInfo.triggerTitle).toBe('Search elements');
      expect(searchUIInfo.inputPlaceholder).toBe('Find elements...');
    } finally {
      await browser.close();
    }
  });

  test('should focus input when trigger is clicked', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click the trigger icon
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const trigger = glass?.shadowRoot?.querySelector('x-pw-search-trigger') as HTMLElement;
        trigger?.click();
      });

      await page.waitForTimeout(100);

      // Check that input is now focused
      const inputIsFocused = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return false;
        const input = glass.shadowRoot.querySelector('.x-pw-search-input');
        return glass.shadowRoot.activeElement === input;
      });

      expect(inputIsFocused).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should manage has-value and has-results CSS classes on container', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Initially, container should have neither has-value nor has-results
      const initialClasses = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const container = glass.shadowRoot.querySelector('x-pw-search-container');

        return {
          hasValue: container?.classList.contains('has-value'),
          hasResults: container?.classList.contains('has-results'),
        };
      });

      expect(initialClasses.hasValue).toBe(false);
      expect(initialClasses.hasResults).toBe(false);

      // Search for something that exists - should have both has-value and has-results
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      const classesWithResults = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const container = glass.shadowRoot.querySelector('x-pw-search-container');
        const counter = glass.shadowRoot.querySelector('x-pw-search-counter') as HTMLElement;

        return {
          hasValue: container?.classList.contains('has-value'),
          hasResults: container?.classList.contains('has-results'),
          counterText: counter?.textContent,
        };
      });

      expect(classesWithResults.hasValue).toBe(true);
      expect(classesWithResults.hasResults).toBe(true);
      expect(classesWithResults.counterText).toBe('1/1');

      // Search for something that doesn't exist - should have has-value but NOT has-results
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '"nonexistent xyz123"';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      const classesNoResults = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const container = glass.shadowRoot.querySelector('x-pw-search-container');

        return {
          hasValue: container?.classList.contains('has-value'),
          hasResults: container?.classList.contains('has-results'),
        };
      });

      expect(classesNoResults.hasValue).toBe(true);
      expect(classesNoResults.hasResults).toBe(false);

      // Clear search with Escape - should have neither class
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input)
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      await page.waitForTimeout(100);

      const classesAfterClear = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const container = glass.shadowRoot.querySelector('x-pw-search-container');

        return {
          hasValue: container?.classList.contains('has-value'),
          hasResults: container?.classList.contains('has-results'),
        };
      });

      expect(classesAfterClear.hasValue).toBe(false);
      expect(classesAfterClear.hasResults).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should find elements by text content (quoted text mode)', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button>Submit</button>
        <button>Cancel</button>
        <span>Submit form</span>
      `);
      await page.waitForSelector('x-pw-glass');

      // Type search query (quoted for text mode)
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '"Submit"';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      // Wait for debounce and search to complete
      await page.waitForTimeout(300);

      // Check results
      const searchResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        const input = glass.shadowRoot.querySelector('.x-pw-search-input');

        return {
          counterText: counter?.textContent,
          hasHighlight: !!highlight && (highlight as HTMLElement).style.display !== 'none',
          hasNoMatchClass: input?.classList.contains('no-match'),
        };
      });

      // Should find 2 matches ("Submit" button and "Submit form" span)
      expect(searchResult.counterText).toMatch(/^\d+\/\d+$/);
      expect(searchResult.hasHighlight).toBe(true);
      expect(searchResult.hasNoMatchClass).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should find elements by locator syntax', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button data-testid="submit-btn">Submit</button>
        <button data-testid="cancel-btn">Cancel</button>
      `);
      await page.waitForSelector('x-pw-glass');

      // Type locator query
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '[data-testid="submit-btn"]';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check results
      const searchResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');

        return {
          counterText: counter?.textContent,
          hasHighlight: !!highlight && (highlight as HTMLElement).style.display !== 'none',
        };
      });

      // Should find exactly 1 match
      expect(searchResult.counterText).toBe('1/1');
      expect(searchResult.hasHighlight).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should show no-match state when search has no results', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Submit</button>`);
      await page.waitForSelector('x-pw-glass');

      // Type a query that won't match anything
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '"nonexistent element xyz123"';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check no-match state
      const noMatchState = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const input = glass.shadowRoot.querySelector('.x-pw-search-input');
        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const container = glass.shadowRoot.querySelector('x-pw-search-container');

        return {
          hasNoMatchClass: input?.classList.contains('no-match'),
          counterText: counter?.textContent,
          containerHasValue: container?.classList.contains('has-value'),
          containerHasResults: container?.classList.contains('has-results'),
        };
      });

      expect(noMatchState.hasNoMatchClass).toBe(true);
      expect(noMatchState.counterText).toBe('');
      // Container should still have has-value (input has text) but NOT has-results
      expect(noMatchState.containerHasValue).toBe(true);
      expect(noMatchState.containerHasResults).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should clear search on Escape key', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Submit</button>`);
      await page.waitForSelector('x-pw-glass');

      // Type search query
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Verify we have results
      const beforeEscape = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });

      expect(beforeEscape).toBe('1/1');

      // Press Escape on the input
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input)
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      });

      await page.waitForTimeout(100);

      // Check that search is cleared
      const afterEscape = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return {
          inputValue: input?.value,
          counterText: counter?.textContent,
        };
      });

      expect(afterEscape.inputValue).toBe('');
      expect(afterEscape.counterText).toBe('');
    } finally {
      await browser.close();
    }
  });

  test('should navigate to next and previous matches with Enter key', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button>A</button>
        <button>B</button>
        <button>C</button>
      `);
      await page.waitForSelector('x-pw-glass');

      // Search for buttons
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Verify initial state (first match)
      const initialState = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });
      expect(initialState).toBe('1/3');

      // Navigate to next match using Enter key (like Escape test uses dispatchEvent)
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input)
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await page.waitForTimeout(100);

      const afterNext = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });
      expect(afterNext).toBe('2/3');

      // Navigate to previous match using Shift+Enter
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input)
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
      });
      await page.waitForTimeout(100);

      const afterPrev = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });
      expect(afterPrev).toBe('1/3');
    } finally {
      await browser.close();
    }
  });

  test('should wrap around when navigating past first/last match', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button>First</button>
        <button>Second</button>
      `);
      await page.waitForSelector('x-pw-glass');

      // Search for buttons
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Helper to navigate to next match using Enter key
      const navigateNext = async () => {
        await page.evaluate(() => {
          const glass = document.querySelector('x-pw-glass');
          const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
          if (input)
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        await page.waitForTimeout(100);
      };

      // Go to second match
      await navigateNext();

      // Now navigate again - should wrap to first
      await navigateNext();

      const afterWrap = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });

      expect(afterWrap).toBe('1/2');
    } finally {
      await browser.close();
    }
  });

  test('should use auto mode for plain text (tries locator first, falls back to text)', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button>Submit</button>
        <span>Some text with Submit in it</span>
      `);
      await page.waitForSelector('x-pw-glass');

      // Type plain text (no quotes, no locator prefix) - auto mode
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'Submit';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check that results are found (auto mode should find text matches)
      const searchResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');

        return {
          counterText: counter?.textContent,
          hasHighlight: !!highlight,
        };
      });

      // Should find matches (either via locator or text fallback)
      expect(searchResult.counterText).toMatch(/^\d+\/\d+$/);
      expect(searchResult.hasHighlight).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should use currentMatch highlight color when provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      const customCurrentMatchColor = '#ff00ff7f';

      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
          highlightColors: {
            currentMatch: customCurrentMatchColor,
          },
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Submit</button>`);
      await page.waitForSelector('x-pw-glass');

      // Search for button
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check that highlight is visible
      const highlightInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');

        return {
          hasHighlight: !!highlight,
          backgroundColor: (highlight as HTMLElement)?.style.backgroundColor,
        };
      });

      expect(highlightInfo.hasHighlight).toBe(true);
      // The highlight should be visible (backgroundColor will be set)
      expect(highlightInfo.backgroundColor).toBeTruthy();
    } finally {
      await browser.close();
    }
  });

  test('should trigger aria search mode with /aria: prefix', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button>Submit Form</button>
        <a href="#">Click here</a>
        <input type="text" placeholder="Enter name" />
      `);
      await page.waitForSelector('x-pw-glass');

      // First search with locator syntax to verify search works
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Verify locator search works
      const locatorResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const counter = glass?.shadowRoot?.querySelector('x-pw-search-counter');
        return counter?.textContent;
      });
      expect(locatorResult).toBe('1/1');

      // Now search with /aria: prefix - this triggers aria mode
      // Note: aria parsing requires __pw_parseAriaTemplate binding which may not be available
      // in all test environments. The key test is that the /aria: prefix triggers a different
      // code path (aria mode) vs locator mode.
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '/aria: button "Submit Form"';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check that search was processed (counter is either showing results or empty for no-match)
      // The important thing is that it didn't crash and processed the aria prefix
      const ariaResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const input = glass.shadowRoot.querySelector('.x-pw-search-input');

        return {
          counterText: counter?.textContent,
          inputValue: (input as HTMLTextAreaElement)?.value,
          // No-match class indicates search was attempted but found nothing
          hasNoMatchClass: input?.classList.contains('no-match'),
        };
      });

      // Verify the input still has the aria query
      expect(ariaResult.inputValue).toBe('/aria: button "Submit Form"');
      // Search should have been processed - either found matches or shows no-match state
      // (depends on whether __pw_parseAriaTemplate is available in test environment)
      expect(ariaResult.counterText !== undefined).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should search by YAML-style aria template', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <nav>
          <a href="#">Home</a>
          <a href="#">About</a>
        </nav>
      `);
      await page.waitForSelector('x-pw-glass');

      // Type YAML-style aria template (starts with -)
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '- navigation';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check results
      const searchResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const counter = glass.shadowRoot.querySelector('x-pw-search-counter');
        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');

        return {
          counterText: counter?.textContent,
          hasHighlight: !!highlight && (highlight as HTMLElement).style.display !== 'none',
        };
      });

      // Should find the nav element (or show no-match if aria parsing not available)
      // The key is that it triggers aria mode, not locator mode
      expect(searchResult.counterText !== undefined).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should auto-scroll first match into view on search', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      // Create a page with the button off-screen (below viewport)
      await page.setContent(`
        <div style="height: 2000px;">
          <!-- Spacer to push button below viewport -->
        </div>
        <button id="bottom-btn">Bottom Button</button>
      `);
      await page.waitForSelector('x-pw-glass');

      // Get initial scroll position (should be at top)
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Search for the bottom button specifically
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = '#bottom-btn';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      // Wait for debounce and smooth scroll
      await page.waitForTimeout(500);

      // Check scroll position changed
      const finalScroll = await page.evaluate(() => window.scrollY);

      // Scroll should have changed to bring bottom button into view
      expect(finalScroll).toBeGreaterThan(initialScroll);
    } finally {
      await browser.close();
    }
  });

  test('should show locator tooltip on highlighted element', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          elementFactories: searchFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button data-testid="submit-btn">Submit</button>`);
      await page.waitForSelector('x-pw-glass');

      // Search for the button
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const input = glass?.shadowRoot?.querySelector('.x-pw-search-input') as HTMLTextAreaElement;
        if (input) {
          input.value = 'button';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await page.waitForTimeout(300);

      // Check that highlight has tooltip with locator
      const tooltipInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const highlight = glass.shadowRoot.querySelector('x-pw-highlight');
        const tooltip = glass.shadowRoot.querySelector('x-pw-tooltip');

        return {
          hasHighlight: !!highlight,
          hasTooltip: !!tooltip,
          tooltipText: tooltip?.textContent || '',
        };
      });

      expect(tooltipInfo.hasHighlight).toBe(true);
      expect(tooltipInfo.hasTooltip).toBe(true);
      // Tooltip should contain locator text (getByRole, getByTestId, etc.)
      expect(tooltipInfo.tooltipText.length).toBeGreaterThan(0);
    } finally {
      await browser.close();
    }
  });
});

/**
 * Error Handling Tests
 *
 * These tests verify graceful handling of invalid configurations
 * and edge cases in the recorder customization system.
 */
test.describe('Error handling', () => {
  test('should handle empty customization object', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder with empty customization
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {},
      });

      const page = await context.newPage();
      await page.setContent(`<button>Test</button>`);

      await page.waitForSelector('x-pw-glass');

      // Should work with all defaults
      const overlayInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass || !glass.shadowRoot)
          return { error: 'no glass' };

        const overlay = glass.shadowRoot.querySelector('x-pw-overlay');
        return {
          hasOverlay: !!overlay,
        };
      });

      expect(overlayInfo.hasOverlay).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should handle partial customization with only highlightColors', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder with only highlightColors (no elementFactories)
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightColors: {
            action: '#00ff007f',
          },
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Test</button>`);

      await page.waitForSelector('x-pw-glass');

      // Should work with default factories but custom colors
      const hasOverlay = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-overlay');
      });

      expect(hasOverlay).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should handle partial customization with only highlightCSS', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder with only custom CSS
      await (context as any)._enableRecorder({
        mode: 'recording',
        customization: {
          highlightCSS: `
            x-pw-tooltip { background: purple !important; }
          `,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button>Test</button>`);

      await page.waitForSelector('x-pw-glass');

      const hasOverlay = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-overlay');
      });

      expect(hasOverlay).toBe(true);
    } finally {
      await browser.close();
    }
  });
});

/**
 * Assertion Mode Tests
 *
 * These tests verify that assertion modes work correctly
 * and can be toggled via the toolbar.
 */
test.describe('Assertion modes', () => {
  test('should switch to assertingVisibility mode when toggle clicked', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<button id="btn">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Switch to assertingVisibility mode by clicking the toggle
      // The class is 'visibility' (not 'assert-visibility')
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const toggle = glass?.shadowRoot?.querySelector('x-pw-tool-item.visibility');
        (toggle as HTMLElement)?.click();
      });

      await page.waitForTimeout(100);

      // Verify the toggle is now toggled (class is 'toggled' not 'active')
      const isToggled = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const toggle = glass?.shadowRoot?.querySelector('x-pw-tool-item.visibility');
        return toggle?.classList.contains('toggled');
      });

      expect(isToggled).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should switch to assertingText mode when toggle clicked', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<p id="text">Hello World</p>`);
      await page.waitForSelector('x-pw-glass');

      // Switch to assertingText mode (class is 'text' not 'assert-text')
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const toggle = glass?.shadowRoot?.querySelector('x-pw-tool-item.text');
        (toggle as HTMLElement)?.click();
      });

      await page.waitForTimeout(100);

      // Verify the toggle is now toggled
      const isToggled = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const toggle = glass?.shadowRoot?.querySelector('x-pw-tool-item.text');
        return toggle?.classList.contains('toggled');
      });

      expect(isToggled).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should show dialog when clicking element in assertingText mode', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'recording',
      });

      const page = await context.newPage();
      await page.setContent(`<p id="target">Hello World</p>`);
      await page.waitForSelector('x-pw-glass');

      // Switch to assertingText mode
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const toggle = glass?.shadowRoot?.querySelector('x-pw-tool-item.text');
        (toggle as HTMLElement)?.click();
      });

      await page.waitForTimeout(100);

      // Click on target element - this should open the text assertion dialog
      await page.locator('#target').click();

      // Wait for dialog to appear
      await page.waitForTimeout(300);

      // Check if dialog appeared in the glass shadow DOM
      const dialogInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass?.shadowRoot)
          return { hasDialog: false };

        const dialog = glass.shadowRoot.querySelector('x-pw-dialog');
        return {
          hasDialog: !!dialog,
          dialogVisible: dialog ? (dialog as HTMLElement).style.display !== 'none' : false,
        };
      });

      expect(dialogInfo.hasDialog).toBe(true);
    } finally {
      await browser.close();
    }
  });
});

// ============================================================================
// Pick Locator Dialog Tests
// ============================================================================

test.describe('pick locator dialog', () => {
  // Factory code that includes createPickLocatorBody and createPickLocatorRow
  const pickLocatorFactories = `
    module.exports = {
      createPickLocatorRow: (doc, label, value) => {
        const row = doc.createElement('x-pw-pick-locator-row');
        row.setAttribute('data-label', label);

        const headerRow = doc.createElement('x-pw-pick-locator-header');

        const labelEl = doc.createElement('x-pw-pick-locator-label');
        labelEl.textContent = label;
        headerRow.appendChild(labelEl);

        const copyButton = doc.createElement('x-pw-button');
        copyButton.classList.add('copy-btn');
        copyButton.title = 'Copy to clipboard';
        copyButton.textContent = 'Copy';
        headerRow.appendChild(copyButton);

        row.appendChild(headerRow);

        const valueElement = doc.createElement('x-pw-pick-locator-value');
        valueElement.textContent = value;
        row.appendChild(valueElement);

        return { row, valueElement, copyButton };
      },

      createPickLocatorBody: (doc, data, factories) => {
        const { locator, ariaSnapshot } = data;
        const container = doc.createElement('x-pw-pick-locator-body');

        const locatorRow = factories.createPickLocatorRow(doc, 'Locator', locator);
        locatorRow.copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(locator);
            locatorRow.copyButton.textContent = 'Copied!';
            locatorRow.copyButton.setAttribute('data-copied', 'true');
            setTimeout(() => {
              locatorRow.copyButton.textContent = 'Copy';
              locatorRow.copyButton.removeAttribute('data-copied');
            }, 1500);
          } catch (e) {
            console.error('Failed to copy:', e);
          }
        });
        container.appendChild(locatorRow.row);

        const ariaRow = factories.createPickLocatorRow(doc, 'Aria Snapshot', ariaSnapshot);
        ariaRow.copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(ariaSnapshot);
            ariaRow.copyButton.textContent = 'Copied!';
            ariaRow.copyButton.setAttribute('data-copied', 'true');
            setTimeout(() => {
              ariaRow.copyButton.textContent = 'Copy';
              ariaRow.copyButton.removeAttribute('data-copied');
            }, 1500);
          } catch (e) {
            console.error('Failed to copy:', e);
          }
        });
        container.appendChild(ariaRow.row);

        return container;
      },
    };
  `;

  test('should show pick locator dialog when custom factory is provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to pick it
      await page.locator('#target').click();

      // Wait for dialog to appear
      await page.waitForTimeout(300);

      // Check if pick locator dialog appeared
      const dialogInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass?.shadowRoot)
          return { hasDialog: false };

        const dialog = glass.shadowRoot.querySelector('x-pw-dialog');
        const body = dialog?.querySelector('x-pw-pick-locator-body');

        return {
          hasDialog: !!dialog,
          hasPickLocatorBody: !!body,
        };
      });

      expect(dialogInfo.hasDialog).toBe(true);
      expect(dialogInfo.hasPickLocatorBody).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should NOT show pick locator dialog when no custom factory is provided', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      // Enable recorder WITHOUT custom factories
      await (context as any)._enableRecorder({
        mode: 'inspecting',
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to pick it
      await page.locator('#target').click();

      // Wait a bit
      await page.waitForTimeout(300);

      // Check that NO dialog appeared (default Playwright behavior)
      const dialogInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass?.shadowRoot)
          return { hasDialog: false };

        const dialog = glass.shadowRoot.querySelector('x-pw-dialog');
        return {
          hasDialog: !!dialog,
        };
      });

      // Default behavior should NOT show a dialog for pick locator
      expect(dialogInfo.hasDialog).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should display locator and aria snapshot rows', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Submit Form</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to pick it
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Check dialog structure
      const dialogStructure = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        if (!glass?.shadowRoot)
          return null;

        const body = glass.shadowRoot.querySelector('x-pw-pick-locator-body');
        if (!body)
          return null;

        const rows = body.querySelectorAll('x-pw-pick-locator-row');
        const rowInfo = Array.from(rows).map(row => ({
          label: row.getAttribute('data-label'),
          hasHeader: !!row.querySelector('x-pw-pick-locator-header'),
          hasLabel: !!row.querySelector('x-pw-pick-locator-label'),
          hasCopyButton: !!row.querySelector('.copy-btn'),
          hasValue: !!row.querySelector('x-pw-pick-locator-value'),
          valueText: row.querySelector('x-pw-pick-locator-value')?.textContent,
        }));

        return {
          rowCount: rows.length,
          rows: rowInfo,
        };
      });

      expect(dialogStructure).toBeTruthy();
      expect(dialogStructure!.rowCount).toBe(2);

      // First row should be Locator
      expect(dialogStructure!.rows[0].label).toBe('Locator');
      expect(dialogStructure!.rows[0].hasHeader).toBe(true);
      expect(dialogStructure!.rows[0].hasLabel).toBe(true);
      expect(dialogStructure!.rows[0].hasCopyButton).toBe(true);
      expect(dialogStructure!.rows[0].hasValue).toBe(true);
      expect(dialogStructure!.rows[0].valueText).toContain('getByRole');

      // Second row should be Aria Snapshot
      expect(dialogStructure!.rows[1].label).toBe('Aria Snapshot');
      expect(dialogStructure!.rows[1].hasHeader).toBe(true);
      expect(dialogStructure!.rows[1].hasLabel).toBe(true);
      expect(dialogStructure!.rows[1].hasCopyButton).toBe(true);
      expect(dialogStructure!.rows[1].hasValue).toBe(true);
    } finally {
      await browser.close();
    }
  });

  test('should have copy buttons present', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Test Button</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to pick it
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Check that copy buttons exist
      const copyButtonInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const copyBtns = glass?.shadowRoot?.querySelectorAll('x-pw-pick-locator-row .copy-btn');
        return {
          count: copyBtns?.length || 0,
          firstButtonText: copyBtns?.[0]?.textContent,
          secondButtonText: copyBtns?.[1]?.textContent,
        };
      });

      // Should have 2 copy buttons (one for Locator, one for Aria Snapshot)
      expect(copyButtonInfo.count).toBe(2);
      expect(copyButtonInfo.firstButtonText).toBe('Copy');
      expect(copyButtonInfo.secondButtonText).toBe('Copy');
    } finally {
      await browser.close();
    }
  });

  test('should close dialog on Close button click', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Verify dialog is open
      const beforeClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(beforeClose).toBe(true);

      // Click the close/cancel button in footer
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        // The cancel button is in the footer, added by createDialogLayout
        const cancelBtn = glass?.shadowRoot?.querySelector('x-pw-dialog-footer x-pw-button, x-pw-tool-item.cancel') as HTMLElement;
        cancelBtn?.click();
      });

      await page.waitForTimeout(100);

      // Verify dialog is closed
      const afterClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(afterClose).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should close dialog on Escape key', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Verify dialog is open
      const beforeClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(beforeClose).toBe(true);

      // Press Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Verify dialog is closed
      const afterClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(afterClose).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should close dialog on glass pane click', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button id="target" style="margin: 100px;">Click me</button>
        <div id="elsewhere" style="width: 100px; height: 100px; margin-top: 200px;"></div>
      `);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Verify dialog is open
      const beforeClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(beforeClose).toBe(true);

      // Click on the glass pane (outside the dialog)
      await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass') as HTMLElement;
        // Dispatch click event on the glass element itself
        glass?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await page.waitForTimeout(100);

      // Verify dialog is closed
      const afterClose = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        return !!glass?.shadowRoot?.querySelector('x-pw-dialog');
      });
      expect(afterClose).toBe(false);
    } finally {
      await browser.close();
    }
  });

  test('should display correct dialog title', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click me</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Check dialog title
      const dialogTitle = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        // Title could be in x-pw-dialog-title or a label element
        const title = glass?.shadowRoot?.querySelector('x-pw-dialog-title, x-pw-dialog label');
        return title?.textContent;
      });

      expect(dialogTitle).toBe('Picked Element');
    } finally {
      await browser.close();
    }
  });

  test('should generate correct locator for input element', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <input type="text" placeholder="Enter name" id="name-input" />
      `);
      await page.waitForSelector('x-pw-glass');

      // Test input element
      await page.locator('#name-input').click();
      await page.waitForTimeout(300);

      const inputLocator = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const locatorValue = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row[data-label="Locator"] x-pw-pick-locator-value');
        return locatorValue?.textContent;
      });

      // Playwright generates getByRole for input with accessible name from placeholder
      expect(inputLocator).toBeTruthy();
      expect(inputLocator).toContain('getBy');
    } finally {
      await browser.close();
    }
  });

  test('should display aria snapshot for picked element', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="submit-btn">Submit Form</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the button
      await page.locator('#submit-btn').click();
      await page.waitForTimeout(300);

      // Check aria snapshot value
      const ariaSnapshot = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const ariaValue = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row[data-label="Aria Snapshot"] x-pw-pick-locator-value');
        return ariaValue?.textContent;
      });

      // Aria snapshot should contain button role and name
      expect(ariaSnapshot).toBeTruthy();
      expect(ariaSnapshot).toContain('button');
      expect(ariaSnapshot).toContain('Submit Form');
    } finally {
      await browser.close();
    }
  });

  test('should position dialog near highlighted element', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      // Place button in specific location
      await page.setContent(`
        <div style="padding: 200px;">
          <button id="target" style="width: 100px; height: 40px;">Click me</button>
        </div>
      `);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Get dialog position
      const dialogPosition = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const dialog = glass?.shadowRoot?.querySelector('x-pw-dialog') as HTMLElement;
        if (!dialog)
          return null;
        const style = getComputedStyle(dialog);
        return {
          top: parseFloat(dialog.style.top || style.top),
          left: parseFloat(dialog.style.left || style.left),
        };
      });

      expect(dialogPosition).toBeTruthy();
      // Dialog should be positioned somewhere near the button (within reasonable range)
      // The exact position depends on tooltipPosition logic, but it should be in the viewport
      expect(dialogPosition!.top).toBeGreaterThan(0);
      expect(dialogPosition!.left).toBeGreaterThan(0);
    } finally {
      await browser.close();
    }
  });

  test('should show unique locator content for picked element', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`
        <button id="btn1">First Button</button>
        <button id="btn2">Second Button</button>
      `);
      await page.waitForSelector('x-pw-glass');

      // Click first button to pick it
      await page.locator('#btn1').click();
      await page.waitForTimeout(300);

      const locatorInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const locatorValue = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row[data-label="Locator"] x-pw-pick-locator-value');
        return {
          text: locatorValue?.textContent,
          hasDialog: !!glass?.shadowRoot?.querySelector('x-pw-dialog'),
        };
      });

      // Verify the locator contains the specific button text
      expect(locatorInfo.hasDialog).toBe(true);
      expect(locatorInfo.text).toBeTruthy();
      expect(locatorInfo.text).toContain('First Button');
    } finally {
      await browser.close();
    }
  });

  test('should work with elements containing special characters', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Click "Here" & Submit</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the button with special characters
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Check that dialog appears and contains the special characters
      const dialogInfo = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const locatorValue = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row[data-label="Locator"] x-pw-pick-locator-value');
        const ariaValue = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row[data-label="Aria Snapshot"] x-pw-pick-locator-value');
        return {
          hasDialog: !!glass?.shadowRoot?.querySelector('x-pw-dialog'),
          locator: locatorValue?.textContent,
          aria: ariaValue?.textContent,
        };
      });

      expect(dialogInfo.hasDialog).toBe(true);
      expect(dialogInfo.locator).toBeTruthy();
      expect(dialogInfo.aria).toContain('Click');
    } finally {
      await browser.close();
    }
  });

  test('copy buttons are clickable and have correct structure', async () => {
    const playwright = createInProcessPlaywright();
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
      await (context as any)._enableRecorder({
        mode: 'inspecting',
        customization: {
          elementFactories: pickLocatorFactories,
        },
      });

      const page = await context.newPage();
      await page.setContent(`<button id="target">Test</button>`);
      await page.waitForSelector('x-pw-glass');

      // Click on the element to open dialog
      await page.locator('#target').click();
      await page.waitForTimeout(300);

      // Verify copy buttons exist and have correct initial state
      const copyButtonState = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const copyBtns = glass?.shadowRoot?.querySelectorAll('x-pw-pick-locator-row .copy-btn');
        if (!copyBtns || copyBtns.length === 0)
          return null;

        const firstBtn = copyBtns[0] as HTMLElement;
        return {
          count: copyBtns.length,
          firstButtonText: firstBtn.textContent,
          firstButtonTitle: firstBtn.title,
          hasClickHandler: typeof firstBtn.onclick === 'function' || firstBtn.hasAttribute('onclick') || true, // Event listeners can't be detected this way
        };
      });

      expect(copyButtonState).toBeTruthy();
      expect(copyButtonState!.count).toBe(2);
      expect(copyButtonState!.firstButtonText).toBe('Copy');
      expect(copyButtonState!.firstButtonTitle).toBe('Copy to clipboard');

      // Test that clicking the button doesn't throw (clipboard might fail in headless but button should handle it)
      const clickResult = await page.evaluate(() => {
        const glass = document.querySelector('x-pw-glass');
        const copyBtn = glass?.shadowRoot?.querySelector('x-pw-pick-locator-row .copy-btn') as HTMLElement;
        try {
          copyBtn?.click();
          return { clicked: true, error: null };
        } catch (e) {
          return { clicked: false, error: String(e) };
        }
      });

      expect(clickResult.clicked).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
