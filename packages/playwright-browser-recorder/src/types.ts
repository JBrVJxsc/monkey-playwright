/**
 * Recorder types exported from Playwright
 * These are the canonical types used by the recorder
 */

// ============================================================================
// Mode types (from packages/recorder/src/recorderTypes.d.ts)
// ============================================================================

export type RecorderMode =
  | 'none'
  | 'recording'
  | 'inspecting'
  | 'standby'
  | 'recording-inspecting'
  | 'assertingText'
  | 'assertingVisibility'
  | 'assertingValue'
  | 'assertingSnapshot';

export const RECORDER_MODES: readonly RecorderMode[] = [
  'none',
  'recording',
  'inspecting',
  'standby',
  'recording-inspecting',
  'assertingText',
  'assertingVisibility',
  'assertingValue',
  'assertingSnapshot',
] as const;

export function isValidRecorderMode(value: string): value is RecorderMode {
  return RECORDER_MODES.includes(value as RecorderMode);
}

// ============================================================================
// Action types (from packages/recorder/src/actions.d.ts)
// ============================================================================

export type Point = { x: number; y: number };

export type ActionName =
  | 'check'
  | 'click'
  | 'hover'
  | 'closePage'
  | 'fill'
  | 'navigate'
  | 'goto' // alias for navigate
  | 'openPage'
  | 'press'
  | 'select'
  | 'selectOption' // alias for select
  | 'uncheck'
  | 'setInputFiles'
  | 'assertText'
  | 'assertValue'
  | 'assertChecked'
  | 'assertVisible'
  | 'assertSnapshot';

export type Signal = {
  name: 'navigation' | 'popup' | 'download' | 'dialog';
  url?: string;
  popupAlias?: string;
  downloadAlias?: string;
  dialogAlias?: string;
};

export interface ActionBase {
  name: ActionName;
  signals: Signal[];
  ariaSnapshot?: string;
  preconditionSelector?: string;
}

export interface ActionWithSelector extends ActionBase {
  selector: string;
  ref?: string;
}

export interface ClickAction extends ActionWithSelector {
  name: 'click';
  button: 'left' | 'middle' | 'right';
  modifiers: number;
  clickCount: number;
  position?: Point;
}

export interface HoverAction extends ActionWithSelector {
  name: 'hover';
  position?: Point;
}

export interface CheckAction extends ActionWithSelector {
  name: 'check';
}

export interface UncheckAction extends ActionWithSelector {
  name: 'uncheck';
}

export interface FillAction extends ActionWithSelector {
  name: 'fill';
  text: string;
}

export interface NavigateAction extends ActionBase {
  name: 'navigate';
  url: string;
}

export interface OpenPageAction extends ActionBase {
  name: 'openPage';
  url: string;
}

export interface ClosePageAction extends ActionBase {
  name: 'closePage';
}

export interface PressAction extends ActionWithSelector {
  name: 'press';
  key: string;
  modifiers: number;
}

export interface SelectAction extends ActionWithSelector {
  name: 'select';
  options: string[];
}

export interface SetInputFilesAction extends ActionWithSelector {
  name: 'setInputFiles';
  files: string[];
}

export interface AssertTextAction extends ActionWithSelector {
  name: 'assertText';
  text: string;
  substring: boolean;
}

export interface AssertValueAction extends ActionWithSelector {
  name: 'assertValue';
  value: string;
}

export interface AssertCheckedAction extends ActionWithSelector {
  name: 'assertChecked';
  checked: boolean;
}

export interface AssertVisibleAction extends ActionWithSelector {
  name: 'assertVisible';
}

export interface AssertSnapshotAction extends ActionWithSelector {
  name: 'assertSnapshot';
  ariaSnapshot: string;
}

export type Action =
  | ClickAction
  | HoverAction
  | CheckAction
  | ClosePageAction
  | OpenPageAction
  | UncheckAction
  | FillAction
  | NavigateAction
  | PressAction
  | SelectAction
  | SetInputFilesAction
  | AssertTextAction
  | AssertValueAction
  | AssertCheckedAction
  | AssertVisibleAction
  | AssertSnapshotAction;

// ============================================================================
// Simplified action type for easier consumption
// ============================================================================

export interface PlaywrightAction {
  name: ActionName;
  selector?: string;
  url?: string;
  text?: string;
  key?: string;
  modifiers?: number;
  position?: Point;
  button?: 'left' | 'middle' | 'right';
  clickCount?: number;
  signals?: Signal[];
  value?: string;
  checked?: boolean;
  ariaSnapshot?: string;
  options?: string[];
  files?: string[];
}

// ============================================================================
// Element info (returned when element is picked)
// ============================================================================

export interface ElementInfo {
  selector: string;
  ariaSnapshot?: string;
}

// ============================================================================
// Recorder callbacks interface
// ============================================================================

export interface RecorderCallbacks {
  onAction?: (action: PlaywrightAction) => void;
  onPerformAction?: (action: PlaywrightAction) => void;
  onElementPicked?: (element: ElementInfo) => void;
  onModeChange?: (mode: RecorderMode) => void;
}
