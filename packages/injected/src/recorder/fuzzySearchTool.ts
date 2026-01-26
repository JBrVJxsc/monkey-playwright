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
 * FuzzySearchTool - Text editor-like search functionality for Playwright recorder toolbar.
 *
 * This module is a CUSTOM ADDITION to the upstream Playwright codebase (not in microsoft/playwright).
 * It provides search functionality in the recorder UI when custom element factories are provided.
 *
 * ## Features
 * - Multiple search modes: locator, aria template, text content, auto
 * - Real-time highlighting of matched elements
 * - Match counter (e.g., "1/5")
 * - Auto-scroll to first match
 * - Collapsible UI: icon when inactive, expands on hover/focus
 *
 * ## Integration
 * The FuzzySearchTool is conditionally instantiated in the Overlay class only when
 * the custom factories include `createSearchContainer`. This ensures:
 * 1. No search UI in default Playwright recorder
 * 2. Search UI appears only when monkey-react provides customization
 *
 * ## Merge Conflict Resolution Guide
 * This file is NEW and should not have conflicts with upstream.
 * If upstream adds similar functionality, consider whether to merge or maintain separately.
 */

import { locatorOrSelectorAsSelector } from '@isomorphic/locatorParser';
import { getFactories, getHighlightColors } from './recorderElementFactories';
import type { ElementText } from '../selectorUtils';
import type { Recorder } from './recorder';

// ============================================================================
// Types
// ============================================================================

export type SearchMode = 'auto' | 'locator' | 'aria' | 'text';

export interface SearchState {
  query: string;
  mode: SearchMode;
  matches: Element[];
  currentIndex: number;
}

// ============================================================================
// Helper Functions (duplicated from recorder.ts to avoid circular imports)
// ============================================================================

function addEventListener(
  target: EventTarget,
  eventName: string,
  listener: EventListener,
  useCapture?: boolean,
): () => void {
  target.addEventListener(eventName, listener, useCapture);
  const remove = () => {
    target.removeEventListener(eventName, listener, useCapture);
  };
  return remove;
}

function removeEventListeners(listeners: (() => void)[]) {
  for (const listener of listeners)
    listener();
  listeners.splice(0, listeners.length);
}

// ============================================================================
// FuzzySearchTool Class
// ============================================================================

/**
 * FuzzySearchTool provides text editor-like search functionality in the recorder toolbar.
 * Supports searching by:
 * - Locator syntax (e.g., getByRole('button'), #id, [data-testid=...])
 * - Aria template (prefix with /aria: or use YAML format starting with -)
 * - Text content (wrap in quotes "text" or 'text')
 * - Auto mode (tries locator first, falls back to text)
 *
 * Features:
 * - Collapsible UI (icon when collapsed, expands on hover/focus/has-value)
 * - Real-time highlighting of matched elements
 * - Match counter (e.g., "1/5")
 * - Auto-scroll to first match
 */
export class FuzzySearchTool {
  private _recorder: Recorder;
  private _container: HTMLElement | null = null;
  private _trigger: HTMLElement | null = null;
  private _expandable: HTMLElement | null = null;
  private _input: HTMLTextAreaElement | null = null;
  private _counter: HTMLElement | null = null;
  private _debounceTimer: number | undefined;
  private _textCache = new Map<Element | ShadowRoot, ElementText>();
  private _state: SearchState = {
    query: '',
    mode: 'auto',
    matches: [],
    currentIndex: -1,
  };
  private _listeners: (() => void)[] = [];

  constructor(recorder: Recorder) {
    this._recorder = recorder;
  }

  install(toolsListElement: HTMLElement) {
    const doc = this._recorder.document;
    const factories = getFactories();

    // NOTE: This method is only called when search factories are provided.
    // The Overlay constructor checks factories.createSearchContainer before calling this.
    // Using non-null assertions (!) because we know these factories exist.

    // Create search container (handles hover state for expand/collapse)
    this._container = factories.createSearchContainer!(doc);

    // Create trigger icon (visible when collapsed)
    if (factories.createSearchTrigger) {
      this._trigger = factories.createSearchTrigger(doc);
      this._container.appendChild(this._trigger);
    }

    // Create expandable wrapper (contains input + counter, expands on hover/focus)
    if (factories.createSearchExpandable) {
      this._expandable = factories.createSearchExpandable(doc);
    } else {
      // Fallback: create a simple div wrapper if factory not provided
      this._expandable = doc.createElement('x-pw-search-expandable');
    }

    // Search input
    this._input = factories.createSearchInput!(doc);
    this._expandable.appendChild(this._input);

    // Match counter (hidden when empty via CSS)
    if (factories.createSearchCounter) {
      this._counter = factories.createSearchCounter(doc);
      this._counter.textContent = '';
      this._expandable.appendChild(this._counter);
    }

    this._container.appendChild(this._expandable);
    toolsListElement.appendChild(this._container);

    // Set up event listeners
    this._listeners = [
      addEventListener(this._input, 'input', () => this._onSearchInput()),
      addEventListener(this._input, 'input', () => this._updateHasValueClass()),
      addEventListener(this._input, 'keydown', e =>
        this._onKeyDown(e as KeyboardEvent),
      ),
    ];

    // Focus input when trigger is clicked (for keyboard accessibility)
    if (this._trigger) {
      this._listeners.push(
          addEventListener(this._trigger, 'click', () => {
            this._input?.focus();
          }),
      );
    }
  }

  /**
   * Updates the has-value class on container based on input content.
   * This keeps the search expanded when there's a value, even without hover/focus.
   */
  private _updateHasValueClass() {
    if (!this._container || !this._input)
      return;
    const hasValue = this._input.value.trim().length > 0;
    this._container.classList.toggle('has-value', hasValue);
  }

  /**
   * Updates the has-results class on container based on match count.
   * This expands the search wider to show the counter when results exist.
   */
  private _updateHasResultsClass() {
    if (!this._container)
      return;
    const hasResults = this._state.matches.length > 0;
    this._container.classList.toggle('has-results', hasResults);
  }

  private _onKeyDown(e: KeyboardEvent) {
    e.stopPropagation(); // Prevent recorder from capturing keystrokes

    if (e.key === 'Escape') {
      this._input!.value = '';
      this._clearSearch();
      return;
    }

    // Navigation with Enter/Shift+Enter or F3/Shift+F3
    if (e.key === 'Enter' || e.key === 'F3') {
      e.preventDefault(); // Prevent form submission or browser find
      if (e.shiftKey)
        this._navigatePrev();
      else
        this._navigateNext();
    }
  }

  private _onSearchInput() {
    // Debounce search
    if (this._debounceTimer) {
      this._recorder.injectedScript.utils.builtins.clearTimeout(
          this._debounceTimer,
      );
    }
    this._debounceTimer =
      this._recorder.injectedScript.utils.builtins.setTimeout(
          () => this._performSearchAsync(),
          150,
      );
  }

  private async _performSearchAsync() {
    const query = this._input?.value.trim() || '';
    if (!query) {
      this._clearSearch();
      return;
    }

    const { mode, searchQuery } = this._detectSearchMode(query);

    let matches: Element[] = [];

    try {
      switch (mode) {
        case 'locator':
          matches = this._searchByLocator(searchQuery);
          break;
        case 'aria':
          matches = await this._searchByAriaAsync(searchQuery);
          break;
        case 'text':
          matches = this._searchByText(searchQuery);
          break;
        case 'auto':
          matches = await this._searchAutoAsync(searchQuery);
          break;
      }
    } catch {
      this._setNoMatch();
      return;
    }

    // Update state
    this._state = {
      query: searchQuery,
      mode,
      matches,
      currentIndex: matches.length > 0 ? 0 : -1,
    };

    this._updateUI();
    this._updateHighlight();

    // Scroll first match into view
    if (matches.length > 0)
      this._scrollToCurrentMatch();

  }

  private _scrollToCurrentMatch() {
    const currentElement = this._state.matches[this._state.currentIndex];
    if (currentElement) {
      currentElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  private _navigateNext() {
    if (this._state.matches.length === 0)
      return;
    this._state.currentIndex =
      (this._state.currentIndex + 1) % this._state.matches.length;
    this._updateUI();
    this._updateHighlight();
    this._scrollToCurrentMatch();
  }

  private _navigatePrev() {
    if (this._state.matches.length === 0)
      return;
    this._state.currentIndex =
      (this._state.currentIndex - 1 + this._state.matches.length) %
      this._state.matches.length;
    this._updateUI();
    this._updateHighlight();
    this._scrollToCurrentMatch();
  }

  private _updateUI() {
    const { matches, currentIndex } = this._state;

    // Update counter (compact format: "1/5") and input state
    if (matches.length === 0 && this._input?.value.trim()) {
      // No matches - just show ring on input, keep counter empty
      if (this._counter)
        this._counter.textContent = '';
      this._input!.classList.add('no-match');
    } else if (matches.length > 0) {
      if (this._counter)
        this._counter.textContent = `${currentIndex + 1}/${matches.length}`;
      this._input!.classList.remove('no-match');
    } else {
      if (this._counter)
        this._counter.textContent = '';
      this._input!.classList.remove('no-match');
    }

    // Update container class for CSS width animation
    this._updateHasResultsClass();
  }

  private _updateHighlight() {
    const { matches, currentIndex } = this._state;

    if (matches.length === 0 || currentIndex < 0) {
      this._recorder.highlight.clearHighlight();
      return;
    }

    const colors = getHighlightColors();
    const currentMatchColor = colors.currentMatch || colors.single;

    // Only highlight the current match, with locator tooltip
    const currentElement = matches[currentIndex];
    const generated = this._recorder.injectedScript.generateSelector(
        currentElement,
        { testIdAttributeName: this._recorder.state.testIdAttributeName },
    );
    const tooltipText = this._recorder.injectedScript.utils.asLocator(
        this._recorder.state.language,
        generated.selector,
    );

    this._recorder.highlight.updateHighlight([
      {
        element: currentElement,
        color: currentMatchColor,
        tooltipText,
      },
    ]);
  }

  private _setNoMatch() {
    this._state = { query: '', mode: 'auto', matches: [], currentIndex: -1 };
    if (this._counter)
      this._counter.textContent = '';
    this._input!.classList.add('no-match');
    this._recorder.highlight.clearHighlight();
    this._updateHasValueClass();
    this._updateHasResultsClass();
  }

  private _clearSearch() {
    this._state = { query: '', mode: 'auto', matches: [], currentIndex: -1 };
    if (this._counter)
      this._counter.textContent = '';
    this._input!.classList.remove('no-match');
    this._recorder.highlight.clearHighlight();
    this._updateHasValueClass();
    this._updateHasResultsClass();
  }

  private _detectSearchMode(query: string): {
    mode: SearchMode;
    searchQuery: string;
  } {
    // /aria: ... -> aria mode
    if (query.startsWith('/aria:'))
      return { mode: 'aria', searchQuery: query.slice(6).trim() };


    // YAML-style aria (starts with - or contains multi-line YAML structure)
    if (query.startsWith('- ') || /^-\s+\w+/.test(query))
      return { mode: 'aria', searchQuery: query };


    // "text" or 'text' -> text mode
    if (
      (query.startsWith('"') && query.endsWith('"')) ||
      (query.startsWith("'") && query.endsWith("'"))
    )
      return { mode: 'text', searchQuery: query.slice(1, -1) };


    // Locator patterns
    const locatorPatterns = [
      /^(getBy|locator|page\.|#|\[|text=|role=|label=|placeholder=)/i,
      /^[a-z-]+\s*=/i, // attribute selectors like data-testid=
    ];

    if (locatorPatterns.some(p => p.test(query)))
      return { mode: 'locator', searchQuery: query };


    return { mode: 'auto', searchQuery: query };
  }

  private _searchByLocator(query: string): Element[] {
    try {
      // Convert locator syntax to internal selector format
      const selector = locatorOrSelectorAsSelector(
          this._recorder.state.language,
          query,
          this._recorder.state.testIdAttributeName,
      );
      const parsedSelector = this._recorder.injectedScript.parseSelector(selector);
      return this._recorder.injectedScript.querySelectorAll(
          parsedSelector,
          this._recorder.document,
      );
    } catch {
      return [];
    }
  }

  private async _searchByAriaAsync(ariaQuery: string): Promise<Element[]> {
    try {
      // Use the server-side binding to parse the aria template
      const parseAriaTemplate = (this._recorder.injectedScript.window as any)
          .__pw_parseAriaTemplate;
      if (!parseAriaTemplate)
        return [];


      const result = await parseAriaTemplate(ariaQuery);
      if (result.error || !result.fragment)
        return [];


      return this._recorder.injectedScript.getAllElementsMatchingExpectAriaTemplate(
          this._recorder.document,
          result.fragment,
      );
    } catch {
      return [];
    }
  }


  private _searchByText(textQuery: string): Element[] {
    this._textCache.clear();
    const results: Element[] = [];
    const normalizedQuery = textQuery.toLowerCase();

    const walker = this._recorder.document.createTreeWalker(
        this._recorder.document.body,
        NodeFilter.SHOW_ELEMENT,
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node as Element;
      const text = this._recorder.injectedScript.utils.elementText(
          this._textCache,
          element,
      );

      if (text.normalized.toLowerCase().includes(normalizedQuery)) {
        // Only include most specific matches (not parents of other matches)
        const hasChildMatch = results.some(r => element.contains(r));
        if (!hasChildMatch) {
          // Remove any parents of this element from results
          for (let i = results.length - 1; i >= 0; i--) {
            if (results[i].contains(element))
              results.splice(i, 1);

          }
          results.push(element);
        }
      }
    }

    // Sort by document order for consistent navigation
    return results.sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  private async _searchAutoAsync(query: string): Promise<Element[]> {
    // Try locator first, fall back to text search
    const locatorResults = this._searchByLocator(query);
    if (locatorResults.length > 0)
      return locatorResults;
    return this._searchByText(query);
  }

  uninstall() {
    if (this._debounceTimer) {
      this._recorder.injectedScript.utils.builtins.clearTimeout(
          this._debounceTimer,
      );
    }
    removeEventListeners(this._listeners);
    this._container?.remove();
  }
}
