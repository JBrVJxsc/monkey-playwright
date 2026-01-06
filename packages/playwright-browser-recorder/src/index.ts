/**
 * playwright-browser-recorder
 *
 * Playwright recorder browser bundle and types for direct browser injection
 */

// Export all types
export * from './types';

// Re-export commonly used types for convenience
export type {
  RecorderMode,
  ActionName,
  Action,
  PlaywrightAction,
  RecorderCallbacks,
  ElementInfo,
  Point,
  Signal,
} from './types';

// Export validation helpers
export { RECORDER_MODES, isValidRecorderMode } from './types';
