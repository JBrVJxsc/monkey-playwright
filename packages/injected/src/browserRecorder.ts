/**
 * Browser-friendly entry point for Playwright Recorder
 * This file exports everything needed to run the recorder in a browser context
 * without requiring Node.js module system.
 */

import { InjectedScript } from './injectedScript';
import { PollingRecorder } from './recorder/pollingRecorder';
import { Recorder } from './recorder/recorder';

export interface InjectedScriptOptions {
  isUnderTest?: boolean;
  sdkLanguage?: string;
  testIdAttributeName?: string;
  stableRafCount?: number;
  browserName?: string;
}

export interface RecorderCallbacks {
  onAction?: (action: unknown) => void;
  onPerformAction?: (action: unknown) => void;
  onElementPicked?: (element: { selector: string; ariaSnapshot?: string }) => void;
  onModeChange?: (mode: string) => void;
  onOverlayStateChange?: (state: unknown) => void;
}

/**
 * SimpleRecorder - A callback-based recorder that doesn't require CDP bindings
 * This is an alternative to PollingRecorder for simpler integration.
 */
export class SimpleRecorder {
  private recorder: Recorder;
  private callbacks: RecorderCallbacks;
  private _mode: string = 'none';
  private _language: string = 'javascript';
  private _testIdAttributeName: string = 'data-testid';

  constructor(
    injectedScript: InjectedScript,
    callbacks: RecorderCallbacks = {}
  ) {
    this.callbacks = callbacks;
    this.recorder = new Recorder(injectedScript, { recorderMode: 'default' });

    // Set up the recorder delegate
    this.recorder.setUIState(
      {
        mode: this._mode as any,
        language: this._language,
        testIdAttributeName: this._testIdAttributeName,
        locator: '',
        actionSelector: '',
        actionPoint: undefined,
        overlay: { offsetX: 0 },
      },
      {
        performAction: async (action) => {
          this.callbacks.onPerformAction?.(action);
        },
        recordAction: async (action) => {
          this.callbacks.onAction?.(action);
        },
        elementPicked: async (element) => {
          this.callbacks.onElementPicked?.(element);
        },
        setMode: async (mode) => {
          this._mode = mode;
          this.callbacks.onModeChange?.(mode);
        },
        setOverlayState: async (state) => {
          this.callbacks.onOverlayStateChange?.(state);
        },
      }
    );
  }

  setMode(mode: 'none' | 'recording' | 'inspecting' | 'standby' | 'recording-inspecting' | 'assertingText' | 'assertingVisibility' | 'assertingValue' | 'assertingSnapshot') {
    this._mode = mode;
    this.recorder.setUIState(
      {
        mode: mode as any,
        language: this._language,
        testIdAttributeName: this._testIdAttributeName,
        locator: '',
        actionSelector: '',
        actionPoint: undefined,
        overlay: { offsetX: 0 },
      },
      {
        performAction: async (action) => {
          this.callbacks.onPerformAction?.(action);
        },
        recordAction: async (action) => {
          this.callbacks.onAction?.(action);
        },
        elementPicked: async (element) => {
          this.callbacks.onElementPicked?.(element);
        },
        setMode: async (mode) => {
          this._mode = mode;
          this.callbacks.onModeChange?.(mode);
        },
        setOverlayState: async (state) => {
          this.callbacks.onOverlayStateChange?.(state);
        },
      }
    );
  }

  getMode() {
    return this._mode;
  }

  destroy() {
    // Clean up if needed
  }
}

// Create a factory function for easier usage
export function createInjectedScript(
  window: Window,
  options: InjectedScriptOptions = {}
): InjectedScript {
  return new InjectedScript(window, {
    isUnderTest: options.isUnderTest ?? false,
    sdkLanguage: options.sdkLanguage ?? 'javascript',
    testIdAttributeName: options.testIdAttributeName ?? 'data-testid',
    customEngines: [],
    stableRafCount: options.stableRafCount ?? 1,
    browserName: options.browserName ?? 'chromium',
    isUtilityWorld: false,
  });
}

// Export everything for browser usage
export { InjectedScript, PollingRecorder, Recorder };

// Expose on window for IIFE usage
if (typeof window !== 'undefined') {
  (window as any).PlaywrightRecorder = {
    InjectedScript,
    PollingRecorder,
    Recorder,
    SimpleRecorder,
    createInjectedScript,
  };
}
