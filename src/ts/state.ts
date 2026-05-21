import type { AppState } from "./types/index.js";

/**
 * The single source of truth for the application's state.
 */
export const appState: AppState = {
  activeTabId: "textReportTab",
  fullScanData: null,
  treeSearchQuery: "",
  expandedFolderPaths: new Set(),
  selectedPaths: new Set(),
  treeNodesByPath: new Map(),
  treeParentPaths: new Map(),
  subtreeNodeCounts: new Map(),
  selectedSubtreeCounts: new Map(),
  processingInProgress: false,
  currentViewingFile: null,
  viewerInstance: null,
  isViewerActive: false,
  scanWorker: null,
  rustIndexReady: false,
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
  folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L10.707 5H15a2 2 0 0 1 2 2v1H3V5Z"/><path fill="currentColor" d="M3 8h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" opacity=".7"/></svg>`,
  file: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Zm0 1.5L17.5 9H14Z"/><path fill="currentColor" d="M9 12h6v1.5H9Zm0 3h6v1.5H9Z" opacity=".9"/></svg>`,
};
