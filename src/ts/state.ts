import type { AppState } from "./types/index.js";

/**
 * The single source of truth for the application's state.
 */
export const appState: AppState = {
  activeTabId: "textReportTab",
  fullScanData: null,
  committedScanData: null,
  selectionCommitted: false,
  processingInProgress: false,
  currentViewingFile: null,
  viewerInstance: null,
  isViewerActive: false,
};

/**
 * A shared, mutable object to hold references to DOM elements.
 * This is populated once at startup.
 */
// biome-ignore lint/suspicious/noExplicitAny: Registry pattern for DOM elements
export const elements: Record<string, any> = {};

/**
 * A shared object for UI constants like icons.
 */
export const ICONS = {
  folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
  file: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
};
