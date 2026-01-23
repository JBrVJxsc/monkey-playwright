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
 * Recorder Element Factories - Customization Layer for Recorder UI
 *
 * This module provides customization points for the Playwright recorder UI elements.
 * It is a CUSTOM ADDITION to the upstream Playwright codebase (not in microsoft/playwright).
 *
 * ## Purpose
 * Allows external applications using monkey-playwright to customize:
 * - Element factory functions (how DOM elements are created)
 * - Highlight CSS styles
 * - Highlight colors
 *
 * ## Architecture
 *
 * ### Bundle Isolation Problem
 * Playwright's injected scripts are built as TWO separate esbuild bundles:
 * - `injectedScriptSource.js` - Contains Highlight class
 * - `pollingRecorderSource.js` - Contains Recorder class, calls configureRecorder()
 *
 * Each bundle has its own copy of this module's code. Module-level variables
 * would NOT be shared between them. To solve this, we use `window.__pwRecorderConfig`
 * as a shared global state store.
 *
 * ### Configuration Flow
 * 1. User calls `context._enableRecorder({ customization: {...} })`
 * 2. Server passes customization to `extendInjectedScript()` in recorder.ts
 * 3. PollingRecorder constructor calls `configureRecorder(options.customization)`
 * 4. Configuration is stored in `window.__pwRecorderConfig`
 * 5. Highlight/Recorder classes call `getFactories()`, `getHighlightCSS()`, etc.
 *
 * ### Merge Conflict Resolution Guide
 * When syncing with upstream microsoft/playwright:
 *
 * 1. This file is NEW - no conflicts expected here.
 *
 * 2. If upstream adds new UI elements in recorder.ts or highlight.ts:
 *    - Add corresponding factory function to `ElementFactories` interface
 *    - Add default implementation to `defaultElementFactories`
 *    - Update the upstream code to use `getFactories().createNewElement(doc)`
 *
 * 3. If upstream changes highlight colors:
 *    - Update `defaultHighlightColors` to match upstream values
 *
 * 4. If upstream restructures recorder.ts Overlay/Dialog classes:
 *    - Ensure factory calls are preserved for each createElement
 *    - Pattern: `doc.createElement('x-pw-*')` → `factories.create*(doc)`
 *
 * ## Usage Example
 * ```typescript
 * await context._enableRecorder({
 *   mode: 'recording',
 *   customization: {
 *     highlightCSS: 'x-pw-tooltip { background: red; }',
 *     highlightColors: { action: '#00ff007f' },
 *     elementFactories: `
 *       module.exports = {
 *         createTooltip: (doc) => {
 *           const el = doc.createElement('x-pw-tooltip');
 *           el.classList.add('my-custom-class');
 *           return el;
 *         },
 *       };
 *     `,
 *   },
 * });
 * ```
 */

import defaultHighlightCSS from '../highlight.css?inline';

/**
 * Color values used for highlighting elements in the recorder.
 * All colors should include alpha channel (8 hex digits or rgba).
 */
export interface HighlightColors {
  /** Color for highlighting multiple matched elements */
  multiple: string;
  /** Color for highlighting a single matched element */
  single: string;
  /** Color for assertion mode highlights */
  assert: string;
  /** Color for action/recording mode highlights */
  action: string;
}

/**
 * Factory functions for creating recorder UI DOM elements.
 *
 * Each factory receives a Document and returns an HTMLElement.
 * Custom implementations can add classes, attributes, or modify structure,
 * but MUST return elements with the expected tag names for CSS to work.
 *
 * @example
 * ```typescript
 * const customFactories: Partial<ElementFactories> = {
 *   createTooltip: (doc) => {
 *     const el = doc.createElement('x-pw-tooltip');
 *     el.setAttribute('data-custom', 'true');
 *     return el;
 *   },
 * };
 * ```
 */
export interface ElementFactories {
  // ============================================
  // Highlight elements (used in highlight.ts)
  // ============================================

  /** Creates the glass pane overlay that covers the page */
  createGlassPane(doc: Document): HTMLElement;

  /** Creates the action point indicator (small dot showing click position) */
  createActionPoint(doc: Document): HTMLElement;

  /** Creates highlight box around selected elements */
  createHighlight(doc: Document): HTMLElement;

  /** Creates tooltip container shown near highlighted elements */
  createTooltip(doc: Document): HTMLElement;

  /** Creates a line of text within the tooltip */
  createTooltipLine(doc: Document, text: string): HTMLElement;

  /** Creates footer section of tooltip */
  createTooltipFooter(doc: Document): HTMLElement;

  // ============================================
  // Overlay elements (toolbar in recorder.ts)
  // ============================================

  /** Creates the main overlay container for the toolbar */
  createOverlay(doc: Document): HTMLElement;

  /** Creates the tools list container within the overlay */
  createToolsList(doc: Document): HTMLElement;

  /** Creates the drag handle/gripper for moving the toolbar */
  createToolGripper(doc: Document): HTMLElement;

  /**
   * Creates a tool button in the toolbar.
   * @param doc - Document to create element in
   * @param name - CSS class name for the tool (e.g., 'record', 'pick-locator')
   * @param title - Tooltip title for the button
   */
  createToolItem(doc: Document, name: string, title: string): HTMLElement;

  /**
   * Creates an icon element for a tool button.
   * Override this to use custom icons (e.g., inline SVG instead of clip-path).
   * @param doc - Document to create element in
   * @param iconName - Name of the icon (e.g., 'record', 'inspect', 'check')
   * @returns Element to be appended inside the tool item
   */
  createToolIcon(doc: Document, iconName: string): Element;

  /** Creates a spacer element for toolbar layout */
  createSpacer(doc: Document): HTMLElement;

  // ============================================
  // Dialog elements (popups in recorder.ts)
  // ============================================

  /**
   * Creates dialog container.
   * @param doc - Document to create element in
   * @param autosize - Whether dialog should auto-size to content
   */
  createDialog(doc: Document, autosize: boolean): HTMLElement;

  /** Creates the body/content area of a dialog */
  createDialogBody(doc: Document): HTMLElement;

  /** Creates action list container (for action selection dialogs) */
  createActionList(doc: Document): HTMLElement;

  /**
   * Creates an action item in action list.
   * @param doc - Document to create element in
   * @param title - Display text for the action
   */
  createActionItem(doc: Document, title: string): HTMLElement;

  /** Creates a separator line in menus/lists */
  createSeparator(doc: Document): HTMLElement;

  // ============================================
  // Extended dialog elements (for custom themes)
  // ============================================

  /** Creates dialog header section */
  createDialogHeader(doc: Document): HTMLElement;

  /**
   * Creates dialog title element.
   * @param doc - Document to create element in
   * @param text - Title text content
   */
  createDialogTitle(doc: Document, text: string): HTMLElement;

  /** Creates dialog footer section for action buttons */
  createDialogFooter(doc: Document): HTMLElement;

  /**
   * Creates a button element.
   * @param doc - Document to create element in
   * @param text - Button text content
   * @param variant - Optional variant class (e.g., 'outline', 'primary')
   */
  createButton(doc: Document, text: string, variant?: string): HTMLElement;

  /**
   * Creates the complete dialog layout including header/toolbar, body, and footer/buttons.
   * Override this factory to completely customize dialog structure.
   *
   * @param doc - Document to create elements in
   * @param options - Dialog configuration
   * @param options.dialogElement - The dialog container to append content to
   * @param options.label - Dialog title/label text
   * @param options.body - Body content element
   * @param options.onAccept - Callback when accept is clicked (undefined if no accept button)
   * @param options.onCancel - Callback when cancel is clicked
   * @param factories - Reference to all factories for creating sub-elements
   */
  createDialogLayout(
    doc: Document,
    options: {
      dialogElement: HTMLElement;
      label: string;
      body: Element;
      onAccept?: () => void;
      onCancel: () => void;
    },
    factories: ElementFactories
  ): void;
}

/**
 * Configuration options for customizing the recorder UI.
 * All properties are optional - defaults will be used for any not specified.
 */
export interface RecorderCustomization {
  /**
   * Custom CSS to replace the default highlight.css.
   * Should include all necessary styles for x-pw-* elements.
   */
  highlightCSS?: string;

  /**
   * Custom highlight colors. Partial object that merges with defaults.
   * @example { action: '#00ff007f', single: '#ff00ff7f' }
   */
  highlightColors?: Partial<HighlightColors>;

  /**
   * JavaScript code string that exports custom element factories.
   * Evaluated as a CommonJS module (use module.exports).
   *
   * @example
   * ```
   * module.exports = {
   *   createTooltip: (doc) => {
   *     const el = doc.createElement('x-pw-tooltip');
   *     el.classList.add('my-tooltip');
   *     return el;
   *   },
   * };
   * ```
   */
  elementFactories?: string;
}

/**
 * Default highlight colors matching upstream Playwright.
 * UPDATE THESE if upstream changes the colors in recorder.ts.
 *
 * Previously these were defined as `const HighlightColors` in recorder.ts.
 */
const defaultHighlightColors: HighlightColors = {
  multiple: '#f6b26b7f',
  single: '#6fa8dc7f',
  assert: '#8acae480',
  action: '#dc6f6f7f',
};

/**
 * Default element factories that replicate upstream Playwright behavior.
 *
 * These implementations match what was previously inline in:
 * - highlight.ts (createGlassPane, createHighlight, createTooltip, etc.)
 * - recorder.ts Overlay class (createOverlay, createToolItem, etc.)
 * - recorder.ts Dialog class (createDialog, createActionList, etc.)
 *
 * MERGE CONFLICT NOTE: If upstream adds new UI elements or changes
 * existing element creation, update these factories to match.
 */
const defaultElementFactories: ElementFactories = {
  // ---- Highlight elements ----
  createGlassPane: (doc: Document) => doc.createElement('x-pw-glass'),
  createActionPoint: (doc: Document) => doc.createElement('x-pw-action-point'),
  createHighlight: (doc: Document) => doc.createElement('x-pw-highlight'),
  createTooltip: (doc: Document) => doc.createElement('x-pw-tooltip'),
  createTooltipLine: (doc: Document, text: string) => {
    const el = doc.createElement('x-pw-tooltip-line');
    el.textContent = text;
    return el;
  },
  createTooltipFooter: (doc: Document) => doc.createElement('x-pw-tooltip-footer'),

  // ---- Overlay/toolbar elements ----
  createOverlay: (doc: Document) => doc.createElement('x-pw-overlay'),
  createToolsList: (doc: Document) => doc.createElement('x-pw-tools-list'),
  createToolGripper: (doc: Document) => {
    const el = doc.createElement('x-pw-tool-gripper');
    el.appendChild(doc.createElement('x-div'));
    return el;
  },
  createToolItem: (doc: Document, name: string, title: string) => {
    const el = doc.createElement('x-pw-tool-item');
    el.classList.add(name);
    el.title = title;
    // Default uses x-div with clip-path icons
    // Override createToolIcon for custom icons (e.g., inline SVG)
    el.appendChild(doc.createElement('x-div'));
    return el;
  },
  createToolIcon: (doc: Document, _iconName: string) => {
    // Default returns x-div for backwards compatibility with clip-path icons
    // Override this to return inline SVG or other icon elements
    return doc.createElement('x-div');
  },
  createSpacer: (doc: Document) => doc.createElement('x-spacer'),

  // ---- Dialog elements ----
  createDialog: (doc: Document, autosize: boolean) => {
    const el = doc.createElement('x-pw-dialog');
    if (autosize)
      el.classList.add('autosize');
    return el;
  },
  createDialogBody: (doc: Document) => doc.createElement('x-pw-dialog-body'),
  createActionList: (doc: Document) => {
    const el = doc.createElement('x-pw-action-list');
    el.setAttribute('role', 'list');
    el.setAttribute('aria-label', 'Choose action');
    return el;
  },
  createActionItem: (doc: Document, title: string) => {
    const el = doc.createElement('x-pw-action-item');
    el.setAttribute('role', 'listitem');
    el.textContent = title;
    el.setAttribute('aria-label', title);
    return el;
  },
  createSeparator: (doc: Document) => doc.createElement('x-pw-separator'),

  // ---- Extended dialog elements ----
  createDialogHeader: (doc: Document) => doc.createElement('x-pw-dialog-header'),
  createDialogTitle: (doc: Document, text: string) => {
    const el = doc.createElement('x-pw-dialog-title');
    el.textContent = text;
    return el;
  },
  createDialogFooter: (doc: Document) => doc.createElement('x-pw-dialog-footer'),
  createButton: (doc: Document, text: string, variant?: string) => {
    const el = doc.createElement('x-pw-button');
    el.textContent = text;
    if (variant)
      el.classList.add(variant);
    return el;
  },

  // Default dialog layout - toolbar with buttons at top (original Playwright style)
  createDialogLayout: (doc, options, factories) => {
    const { dialogElement, label, body, onAccept, onCancel } = options;

    // Toolbar with label and buttons at top
    const toolbarElement = factories.createToolsList(doc);
    const labelElement = doc.createElement('label');
    labelElement.textContent = label;
    toolbarElement.appendChild(labelElement);
    toolbarElement.appendChild(factories.createSpacer(doc));

    if (onAccept) {
      const acceptButton = factories.createToolItem(doc, 'accept', 'Accept');
      acceptButton.addEventListener('click', () => onAccept());
      toolbarElement.appendChild(acceptButton);
    }

    const cancelButton = factories.createToolItem(doc, 'cancel', 'Close');
    cancelButton.addEventListener('click', () => onCancel());
    toolbarElement.appendChild(cancelButton);

    dialogElement.appendChild(toolbarElement);

    // Body with content
    const bodyElement = factories.createDialogBody(doc);
    bodyElement.appendChild(body);
    dialogElement.appendChild(bodyElement);
  },
};

// ============================================================================
// Global Configuration Store
// ============================================================================

/**
 * Extend Window interface to include our global config.
 * Using window as shared state because injectedScriptSource.js and
 * pollingRecorderSource.js are separate bundles with isolated module scopes.
 */
declare const window: Window & {
  __pwRecorderConfig?: {
    factories: ElementFactories;
    highlightCSS: string;
    highlightColors: HighlightColors;
    configured: boolean;
  };
};

/**
 * Gets or initializes the global configuration object.
 * Uses lazy initialization to ensure defaults are set on first access.
 * @internal
 */
function getGlobalConfig() {
  if (!window.__pwRecorderConfig) {
    window.__pwRecorderConfig = {
      factories: defaultElementFactories,
      highlightCSS: defaultHighlightCSS,
      highlightColors: defaultHighlightColors,
      configured: false,
    };
  }
  return window.__pwRecorderConfig;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Configures the recorder with custom settings.
 *
 * MUST be called before Recorder/Highlight classes are instantiated.
 * Called automatically by PollingRecorder constructor if customization is provided.
 *
 * This function is idempotent - subsequent calls after the first are ignored.
 * This prevents re-configuration if the recorder is re-initialized.
 *
 * @param customization - Optional customization options
 *
 * @example
 * ```typescript
 * configureRecorder({
 *   highlightColors: { action: '#00ff007f' },
 *   highlightCSS: customCSSString,
 *   elementFactories: factoriesModuleString,
 * });
 * ```
 */
export function configureRecorder(customization?: RecorderCustomization): void {
  const config = getGlobalConfig();

  // Only configure once - prevents re-configuration on recorder restart
  if (config.configured || !customization)
    return;
  config.configured = true;

  // Apply custom CSS (complete replacement)
  if (customization.highlightCSS)
    config.highlightCSS = customization.highlightCSS;

  // Apply custom colors (merged with defaults)
  if (customization.highlightColors)
    config.highlightColors = { ...defaultHighlightColors, ...customization.highlightColors };

  // Apply custom element factories (merged with defaults)
  if (customization.elementFactories) {
    try {
      // Evaluate the factories as a CommonJS module
      // The string should use `module.exports = { ... }`
      const evalResult = new Function(`
        const module = { exports: {} };
        ${customization.elementFactories}
        return module.exports;
      `)();
      const customFactories = evalResult.default || evalResult;
      config.factories = { ...defaultElementFactories, ...customFactories };
    } catch (e) {
      // Log error but don't throw - fall back to defaults
      console.error('Failed to evaluate custom element factories:', e); // eslint-disable-line no-console
    }
  }
}

/**
 * Gets the current element factories (custom or default).
 *
 * Used by:
 * - highlight.ts: createGlassPane, createHighlight, createTooltip, etc.
 * - recorder.ts Overlay: createOverlay, createToolItem, etc.
 * - recorder.ts Dialog: createDialog, createActionList, etc.
 *
 * @returns The configured ElementFactories object
 */
export function getFactories(): ElementFactories {
  return getGlobalConfig().factories;
}

/**
 * Gets the current highlight CSS (custom or default).
 *
 * Used by highlight.ts to inject styles into the glass pane shadow DOM.
 *
 * @returns CSS string for highlight styling
 */
export function getHighlightCSS(): string {
  return getGlobalConfig().highlightCSS;
}

/**
 * Gets the current highlight colors (custom or default).
 *
 * Used throughout recorder.ts for element highlighting.
 * Replaces the old `HighlightColors` constant that was in recorder.ts.
 *
 * @returns The configured HighlightColors object
 */
export function getHighlightColors(): HighlightColors {
  return getGlobalConfig().highlightColors;
}

/**
 * Resets configuration to defaults. Primarily for testing.
 * @internal
 */
export function resetRecorderConfiguration(): void {
  const config = getGlobalConfig();
  config.factories = defaultElementFactories;
  config.highlightCSS = defaultHighlightCSS;
  config.highlightColors = defaultHighlightColors;
  config.configured = false;
}
