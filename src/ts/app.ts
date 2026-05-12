// --- CSS IMPORTS (Forces bundling) ---
import "../css/app.css";
import "../css/components.css";
import "../css/tree.css";
import "../css/viewer.css";
import "../css/modals.css";
import "../css/report.css";
import "../css/stats.css";
import "../css/dropoverlay.css";

import { downloadZip, exportCombined } from "./features.js";
import type { ScanAggregator } from "./filesystem.js";
import { filterScanData, initTypeData, scanDir, scanFileList } from "./filesystem.js";
import { appState, elements } from "./state.js";
import type { FolderInfo, ScanData } from "./types/index.js";
import {
  closeViewer,
  copyCurrentReport,
  disableUIControls,
  enableUIControls,
  initTreeState,
  initLayout,
  initSidebarResizer,
  initTabs,
  populateElements,
  refreshAllUI,
  renderTree,
  resetUIForProcessing,
  setAllSelections,
  showFailedUI,
  showNotification,
  toggleAllFolders,
} from "./ui/index.js";
import type { VirtualDirectoryHandle } from "./utils/crossbrowser_fs.js";
import { buildFromEntry, showFolderPicker } from "./utils/crossbrowser_fs.js";

async function processDirectory(handle: VirtualDirectoryHandle): Promise<void> {
  performance.mark("diranalyze:process-directory:start");
  appState.processingInProgress = true;
  appState.committedScanData = null;
  appState.selectionCommitted = false;
  resetUIForProcessing(`Processing '${handle.name}'...`);
  disableUIControls();

  await finishScan(handle);
}

async function processFileList(files: FileList): Promise<void> {
  performance.mark("diranalyze:process-directory:start");
  appState.processingInProgress = true;
  appState.committedScanData = null;
  appState.selectionCommitted = false;

  const rootName = getFileListRootName(files) || "PROJECT";
  resetUIForProcessing(`Processing '${rootName}'...`);
  disableUIControls();

  performance.mark("diranalyze:scan-file-list:start");
  const scanRes = await scanFileList(files);
  logPerfMeasure(
    "scan-file-list",
    "diranalyze:scan-file-list:start",
    "diranalyze:scan-file-list:end",
  );

  if (scanRes.ok) {
    applyScanData(scanRes.value);
  } else {
    showFailedUI("Scan failed.");
    console.error(scanRes.error);
  }

  appState.processingInProgress = false;
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
}

async function finishScan(handle: VirtualDirectoryHandle) {
  performance.mark("diranalyze:scan:start");
  const agg: ScanAggregator = {
    allFilesList: [],
    allFoldersList: [],
    maxDepth: 0,
  };
  const scanRes = await scanDir(handle, handle.name, 0, agg);
  logPerfMeasure("scan", "diranalyze:scan:start", "diranalyze:scan:end");
  if (scanRes.ok) {
    applyScanData({ directoryData: scanRes.value, ...agg });
  } else {
    showFailedUI("Scan failed.");
    console.error(scanRes.error);
  }
  appState.processingInProgress = false;
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
}

function applyScanData(data: ScanData): void {
  appState.fullScanData = data;
  appState.committedScanData = null;
  appState.selectionCommitted = false;
  updateUI(appState.fullScanData.directoryData as FolderInfo);
}

function updateUI(data: FolderInfo) {
  performance.mark("diranalyze:update-ui:start");
  const container = elements.treeContainer;
  if (container) {
    initTreeState(data, {
      initialCollapsed: true,
      initialSelected: false,
    });
    container.innerHTML = "";
    renderTree(data, container);
    refreshAllUI();
    enableUIControls();
    logPerfMeasure(
      "update-ui",
      "diranalyze:update-ui:start",
      "diranalyze:update-ui:end",
    );
    requestAnimationFrame(() => {
      logPerfMeasure(
        "visible-load",
        "diranalyze:process-directory:start",
        "diranalyze:visible-load:end",
      );
    });
  }
}

function commitSelections(): void {
  if (!appState.fullScanData) return;
  const selectedPaths = new Set(appState.selectedPaths);

  if (selectedPaths.size === 0) {
    showNotification("Select at least one file or folder before commit.", 2500);
    return;
  }

  appState.committedScanData = filterScanData(
    appState.fullScanData,
    selectedPaths,
  );
  appState.selectionCommitted = true;
  refreshAllUI();
  enableUIControls();
  showNotification("Selection committed.", 1500);
}

function clearProject(): void {
  appState.fullScanData = null;
  appState.committedScanData = null;
  appState.expandedFolderPaths.clear();
  appState.selectedPaths.clear();
  appState.treeNodesByPath.clear();
  appState.treeParentPaths.clear();
  appState.subtreeNodeCounts.clear();
  appState.selectedSubtreeCounts.clear();
  appState.selectionCommitted = false;
  appState.processingInProgress = false;
  resetUIForProcessing();
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
  enableUIControls(false);
}

// ============================================================================
// FULL-PAGE DROP OVERLAY
// ============================================================================

let dragCounter = 0; // Track nested drag events

function showDropOverlay(): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay && !appState.processingInProgress) {
    overlay.classList.add("visible", "drag-over");
  }
}

function hideDropOverlay(): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay) {
    overlay.classList.remove("visible", "drag-over");
  }
}

function isDraggingFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

function setupFullPageDrop(): void {
  // Prevent default drag behaviors on document
  document.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    if (isDraggingFiles(e)) {
      showDropOverlay();
    }
  });

  document.addEventListener("dragenter", (e: DragEvent) => {
    e.preventDefault();
    dragCounter++;
    
    // Check if dragging files/folders
    if (e.dataTransfer?.types.includes("Files")) {
      showDropOverlay();
    }
  });

  document.addEventListener("dragleave", (e: DragEvent) => {
    e.preventDefault();
    dragCounter--;
    
    if (dragCounter === 0) {
      hideDropOverlay();
    }
  });

  document.addEventListener("drop", (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = e.dataTransfer?.files;
    if (
      droppedFiles &&
      droppedFiles.length > 0 &&
      canScanDroppedFileList(droppedFiles) &&
      !appState.processingInProgress
    ) {
      dragCounter = 0;
      hideDropOverlay();
      void processFileList(droppedFiles);
      return;
    }

    let entry: FileSystemEntry | null = null;
    if (e.dataTransfer && !appState.processingInProgress) {
      const items = Array.from(e.dataTransfer.items);
      for (const item of items) {
        if (item.kind !== "file") continue;
        entry = item.webkitGetAsEntry();
        if (entry?.isDirectory) break;
        entry = null;
      }
    }

    dragCounter = 0;
    hideDropOverlay();

    if (!entry) {
      if (!appState.processingInProgress) {
        showNotification("Please drop a folder, not a file.", 4000);
      }
      return;
    }

    performance.mark("diranalyze:build-handle:start");
    void buildFromEntry(entry).then((handle) => {
      logPerfMeasure(
        "build-handle",
        "diranalyze:build-handle:start",
        "diranalyze:build-handle:end",
      );
      if (handle) {
        return processDirectory(handle);
      }

      showNotification("Could not read folder.", 4000);
    });
  });
}

function canScanDroppedFileList(files: FileList): boolean {
  return getFileListRootName(files) !== null;
}

function getFileListRootName(files: FileList): string | null {
  if (files.length === 0) return null;

  const firstFile = files[0] as File & { webkitRelativePath?: string };
  const relativePath = firstFile.webkitRelativePath || "";
  if (!relativePath.includes("/")) {
    return null;
  }

  return relativePath.split("/")[0] || null;
}

// ============================================================================
// FOLDER SELECT BUTTON (uses <input webkitdirectory> - works in all browsers)
// ============================================================================

async function handleSelect(): Promise<void> {
  console.log("[handleSelect] Called, processingInProgress:", appState.processingInProgress);
  if (appState.processingInProgress) return;

  const hiddenInput = document.getElementById("hiddenFolderInput") as HTMLInputElement | null;
  if (hiddenInput) {
    hiddenInput.click();
    return;
  }

  const handle = await showFolderPicker();
  console.log("[handleSelect] Got handle:", handle);
  if (handle) {
    await processDirectory(handle);
  } else {
    console.log("[handleSelect] No handle returned (cancelled or error)");
  }
}

// ============================================================================
// HIDDEN FILE INPUT FOR FALLBACK (already in DOM via layout)
// ============================================================================

function setupHiddenInput(): void {
  // Check if there's already a hidden input, if not create one
  let hiddenInput = document.getElementById("hiddenFolderInput") as HTMLInputElement | null;
  
  if (!hiddenInput) {
    hiddenInput = document.createElement("input");
    hiddenInput.type = "file";
    hiddenInput.id = "hiddenFolderInput";
    hiddenInput.setAttribute("webkitdirectory", "");
    hiddenInput.multiple = true;
    hiddenInput.style.display = "none";
    document.body.appendChild(hiddenInput);
  }

  hiddenInput.addEventListener("change", async () => {
    const files = hiddenInput!.files;
    if (files && files.length > 0) {
      await processFileList(files);
    }
    // Reset for next use
    hiddenInput!.value = "";
  });
}

function setupListeners(): void {
  // Full-page drop is handled separately
  setupFullPageDrop();

  elements.selectFolderBtn?.addEventListener("click", handleSelect);
  elements.commitSelectionsBtn?.addEventListener("click", commitSelections);
  elements.downloadProjectBtn?.addEventListener("click", downloadZip);
  elements.clearProjectBtn?.addEventListener("click", clearProject);
  elements.selectAllBtn?.addEventListener("click", () =>
    setAllSelections(true),
  );
  elements.deselectAllBtn?.addEventListener("click", () =>
    setAllSelections(false),
  );
  elements.expandAllBtn?.addEventListener("click", () =>
    toggleAllFolders(false),
  );
  elements.collapseAllBtn?.addEventListener("click", () =>
    toggleAllFolders(true),
  );
  elements.copyReportButton?.addEventListener("click", () => {
    void copyCurrentReport();
  });
  elements.closeViewerBtn?.addEventListener("click", closeViewer);
  elements.aiDebriefingAssistantBtn?.addEventListener("click", exportCombined);
}

function logPerfMeasure(name: string, startMark: string, endMark: string): void {
  performance.mark(endMark);
  try {
    performance.measure(`diranalyze:${name}`, startMark, endMark);
    const entries = performance.getEntriesByName(`diranalyze:${name}`, "measure");
    const latest = entries.at(-1);
    if (latest) {
      console.info(`[perf] ${name}: ${latest.duration.toFixed(1)}ms`);
    }
  } catch {
    // Ignore measurement failures when the browser drops a mark.
  }
}

async function init() {
  initLayout();
  populateElements();
  initTabs();
  initSidebarResizer();
  setupHiddenInput();

  // Load filetype data
  try {
    const response = await fetch("/data/filetypes.json");
    const data = await response.json();
    initTypeData(data);
  } catch (e) {
    console.warn("Could not load filetypes.json, using defaults");
  }

  setupListeners();
  disableUIControls();
  elements.pageLoader?.classList.add("hidden");
  console.log("DirAnalyze Streamline (Cross-Browser) Initialized.");
}

document.addEventListener("DOMContentLoaded", init);
