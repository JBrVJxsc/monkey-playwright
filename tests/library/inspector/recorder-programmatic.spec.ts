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

import { test, expect } from "./inspectorTest";

import type { Page } from "@playwright/test";
import type * as actions from "@recorder/actions";
import type {
  Mode,
  Source,
  ElementInfo,
  CallLog,
} from "@recorder/recorderTypes";

/**
 * Extended RecorderLog that captures all events from the programmatic recorder mode.
 */
class ProgrammaticRecorderLog {
  actions: (actions.ActionInContext & { code: string })[] = [];
  signals: actions.SignalInContext[] = [];
  modeChanges: Mode[] = [];
  pauseStateChanges: boolean[] = [];
  sourcesUpdates: { sources: Source[]; pausedSourceId?: string }[] = [];
  pageNavigations: (string | undefined)[] = [];
  elementsPicked: { elementInfo: ElementInfo; userGesture?: boolean }[] = [];
  callLogsUpdates: CallLog[][] = [];

  actionAdded(
    page: Page,
    actionInContext: actions.ActionInContext,
    code: string,
  ): void {
    this.actions.push({ ...actionInContext, code });
  }

  actionUpdated(
    page: Page,
    actionInContext: actions.ActionInContext,
    code: string,
  ): void {
    this.actions[this.actions.length - 1] = { ...actionInContext, code };
  }

  signalAdded(page: Page, signal: actions.SignalInContext): void {
    this.signals.push(signal);
  }

  modeChanged(mode: Mode): void {
    this.modeChanges.push(mode);
  }

  pauseStateChanged(paused: boolean): void {
    this.pauseStateChanges.push(paused);
  }

  sourcesUpdated(sources: Source[]): void {
    this.sourcesUpdates.push({ sources });
  }

  pageNavigated(url: string | undefined): void {
    this.pageNavigations.push(url);
  }

  elementPicked(elementInfo: ElementInfo, userGesture?: boolean): void {
    this.elementsPicked.push({ elementInfo, userGesture });
  }

  callLogsUpdated(callLogs: CallLog[]): void {
    this.callLogsUpdates.push(callLogs);
  }
}

async function startProgrammaticRecording(context: any) {
  const log = new ProgrammaticRecorderLog();
  await context._enableRecorder(
    {
      mode: "recording",
      recorderMode: "programmatic",
    },
    log,
  );
  return {
    log,
    action: (name: string) => log.actions.filter((a) => a.action.name === name),
    sendCommand: (method: string, params?: any) =>
      context._sendRecorderCommand(method, params),
  };
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

test.describe("Programmatic Recorder API", () => {
  test("should receive initial state events", async ({ context }) => {
    const { log } = await startProgrammaticRecording(context);

    // Should receive initial mode and pause state
    expect(log.modeChanges).toContain("recording");
    expect(log.pauseStateChanges).toContain(false);
  });

  test("should record click actions", async ({ context }) => {
    const { action } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(
      `<button onclick="console.log('click')">Submit</button>`,
    );
    await page.getByRole("button", { name: "Submit" }).click();

    const clickActions = action("click");
    expect(clickActions).toHaveLength(1);
    expect(clickActions[0].action.name).toBe("click");
    expect(normalizeCode(clickActions[0].code)).toContain(
      `getByRole('button', { name: 'Submit' })`,
    );
  });

  test("should send setMode command", async ({ context }) => {
    const { log, sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Clear initial events
    log.modeChanges.length = 0;

    // Change mode to inspecting
    await sendCommand("setMode", { mode: "inspecting" });

    // Should receive modeChanged event
    expect(log.modeChanges).toContain("inspecting");
  });

  test("should send clear command", async ({ context }) => {
    const { action, sendCommand } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`<button>Click me</button>`);
    await page.getByRole("button", { name: "Click me" }).click();

    expect(action("click")).toHaveLength(1);

    // Clear the recording
    await sendCommand("clear");

    // Note: clear() doesn't remove already recorded actions from our log,
    // it just clears the internal state for navigation-based reset
  });

  test("should send step command", async ({ context }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Step command should not throw (it resumes with single-step)
    await sendCommand("step");
  });

  test("should send highlightRequested command with selector", async ({
    context,
  }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`<button id="myBtn">Highlight me</button>`);

    // This should highlight the element in the browser
    await sendCommand("highlightRequested", { selector: "#myBtn" });

    // No direct event for this, but it should not throw
  });

  test("should send hideHighlight command", async ({ context }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Should not throw
    await sendCommand("hideHighlight");
  });

  test("should send setLanguage command", async ({ context }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Should not throw
    await sendCommand("setLanguage", { language: "python" });
  });

  test("should throw on unknown command", async ({ context }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    await expect(sendCommand("unknownCommand", {})).rejects.toThrow(
      "Unknown recorder command: unknownCommand",
    );
  });

  test("should record fill actions", async ({ context }) => {
    const { action } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`<input type="text" placeholder="Enter text" />`);
    await page.getByPlaceholder("Enter text").fill("Hello World");
    // Small wait to ensure action event is processed
    await page.waitForTimeout(100);

    const fillActions = action("fill");
    expect(fillActions).toHaveLength(1);
    expect(fillActions[0].action.name).toBe("fill");
    expect((fillActions[0].action as any).text).toBe("Hello World");
  });

  test("should record select actions", async ({ context }) => {
    const { action } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`
      <select>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </select>
    `);
    await page.getByRole("combobox").selectOption("b");

    const selectActions = action("select");
    expect(selectActions).toHaveLength(1);
    expect(selectActions[0].action.name).toBe("select");
  });

  test("should toggle between recording and inspecting modes", async ({
    context,
  }) => {
    const { log, sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Clear initial events
    log.modeChanges.length = 0;

    // Toggle to inspecting
    await sendCommand("setMode", { mode: "inspecting" });
    expect(log.modeChanges).toContain("inspecting");

    // Toggle back to recording
    await sendCommand("setMode", { mode: "recording" });
    expect(log.modeChanges).toContain("recording");
  });

  test("should work with navigation signals", async ({ context, server }) => {
    const { log } = await startProgrammaticRecording(context);
    const page = await context.newPage();

    await page.goto(server.EMPTY_PAGE);

    // Should receive page navigation event
    expect(log.pageNavigations.length).toBeGreaterThan(0);
  });

  test("should disable recorder and stop receiving events", async ({
    context,
  }) => {
    const { log, action } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`<button>Click me</button>`);

    await page.getByRole("button", { name: "Click me" }).click();
    expect(action("click")).toHaveLength(1);

    // Disable recorder
    await (context as any)._disableRecorder();

    // This click should not be recorded
    await page.getByRole("button", { name: "Click me" }).click();
    expect(action("click")).toHaveLength(1); // Still 1, not 2
  });

  test("sendRecorderCommand should fail when recorder not enabled", async ({
    context,
  }) => {
    // Don't enable recorder, just try to send command
    await expect(
      (context as any)._sendRecorderCommand("setMode", { mode: "recording" }),
    ).rejects.toThrow("Recorder is not enabled");
  });

  test("should handle setMode command with missing params gracefully", async ({
    context,
  }) => {
    const { log, sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    const initialModeCount = log.modeChanges.length;

    // Send setMode without mode param - should not crash or change mode
    await sendCommand("setMode", {});
    await sendCommand("setMode", undefined);

    // Mode should not have changed
    expect(log.modeChanges.length).toBe(initialModeCount);
  });

  test("should send resume command", async ({ context }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    await context.newPage();

    // Resume command should execute without throwing
    // Note: We don't test pause() directly because it waits for user interaction
    // and would cause test timeout. The step() test covers the pause functionality.
    await sendCommand("resume");
  });

  test("should send highlightRequested command with ariaTemplate", async ({
    context,
  }) => {
    const { sendCommand } = await startProgrammaticRecording(context);
    const page = await context.newPage();
    await page.setContent(`<button aria-label="Submit form">Submit</button>`);

    // This should highlight the element using aria template
    await sendCommand("highlightRequested", {
      ariaTemplate: { role: "button", name: "Submit form" },
    });

    // Should not throw
  });

  test("should work with showSidePanel option for debugging", async ({
    context,
    toImpl,
  }) => {
    const log = new ProgrammaticRecorderLog();
    await (context as any)._enableRecorder(
      {
        mode: "recording",
        recorderMode: "programmatic",
        showSidePanel: true,
      },
      log,
    );

    const page = await context.newPage();
    await page.setContent(`<button>Test</button>`);
    await page.getByRole("button", { name: "Test" }).click();

    // Programmatic API should still receive events
    const clickActions = log.actions.filter((a) => a.action.name === "click");
    expect(clickActions).toHaveLength(1);

    // Side panel should also be opened (recorderAppForTest is set when side window opens)
    expect(toImpl(context).recorderAppForTest).toBeTruthy();
  });
});
