// --- CSS IMPORTS (Forces bundling) ---
import "../css/app.css";
import "../css/components.css";
import "../css/tree.css";
import "../css/viewer.css";
import "../css/modals.css";
import "../css/report.css";
import "../css/stats.css";

import { downloadZip, exportCombined } from "./features.js";
import type { ScanAggregator } from "./filesystem.js";
import { filterScanData, initTypeData, scanDir } from "./filesystem.js";
import { appState, elements } from "./state.js";
import type { FolderInfo } from "./types/index.js";
import {
  closeViewer,
  disableUIControls,
  enableUIControls,
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
import { buildFromDropItem, buildFromFileList, showFolderPicker } from "./utils/crossbrowser_fs.js";

async function processDirectory(handle: VirtualDirectoryHandle): Promise<void> {
  resetUIForProcessing(`Processing '${handle.name}'...`);

  const res = await scanDir(handle, handle.name, 0);
  if (!res.ok) {
    showFailedUI("Scan failed.");
    console.error(res.error);
    return;
  }

  await finishScan(handle, res.value);
}

async function finishScan(handle: VirtualDirectoryHandle, data: FolderInfo) {
  appState.fullScanData = {
    directoryData: data,
    allFilesList: [],
    allFoldersList: [],
    maxDepth: 0,
  };
  const agg: ScanAggregator = {
    allFilesList: [],
    allFoldersList: [],
    maxDepth: 0,
  };
  const scanRes = await scanDir(handle, handle.name, 0, agg);
  if (scanRes.ok) {
    appState.fullScanData = { directoryData: scanRes.value, ...agg };
    appState.committedScanData = appState.fullScanData;
    appState.selectionCommitted = true;
    updateUI(appState.fullScanData.directoryData as FolderInfo);
  }
  appState.processingInProgress = false;
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
}

function updateUI(data: FolderInfo) {
  const container = elements.treeContainer;
  if (container) {
    container.innerHTML = "";
    renderTree(data, container);
    refreshAllUI();
    enableUIControls();
  }
}

function commitSelections(): void {
  if (!appState.fullScanData) return;
  const selectedPaths = new Set<string>();
  elements.treeContainer
    ?.querySelectorAll('li[data-selected="true"]')
    .forEach((el: Element) => {
      const li = el as HTMLElement;
      const path = li.dataset.path;
      if (path) selectedPaths.add(path);
    });

  appState.committedScanData = filterScanData(
    appState.fullScanData,
    selectedPaths,
  );
  appState.selectionCommitted = true;
  refreshAllUI();
  showNotification("Selection committed.", 1500);
}

function clearProject(): void {
  resetUIForProcessing();
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
  enableUIControls(false);
}

// ============================================================================
// DRAG & DROP HANDLER (uses webkitGetAsEntry - works in all browsers)
// ============================================================================

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  elements.dropZone?.classList.remove("dragover");
  if (appState.processingInProgress || !event.dataTransfer) return;

  const items = Array.from(event.dataTransfer.items);
  
  for (const item of items) {
    if (item.kind === "file") {
      const handle = await buildFromDropItem(item);
      if (handle) {
        return processDirectory(handle);
      }
    }
  }
  
  showNotification("Error: Please drop a single folder.", 4000);
}

// ============================================================================
// FOLDER SELECT BUTTON (uses <input webkitdirectory> - works in all browsers)
// ============================================================================

async function handleSelect(): Promise<void> {
  if (appState.processingInProgress) return;
  
  const handle = await showFolderPicker();
  if (handle) {
    await processDirectory(handle);
  }
  // If null, user cancelled - do nothing
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
      const handle = buildFromFileList(files);
      if (handle) {
        await processDirectory(handle);
      }
    }
    // Reset for next use
    hiddenInput!.value = "";
  });
}

function setupListeners(): void {
  const dz = elements.dropZone;
  if (dz) {
    dz.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    dz.addEventListener("dragenter", (e: DragEvent) => {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e: DragEvent) => handleDrop(e));
  }

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
    const text = elements.textOutput?.textContent || "";
    navigator.clipboard
      .writeText(text)
      .then(() => showNotification("Report copied!", 2000));
  });
  elements.closeViewerBtn?.addEventListener("click", closeViewer);
  elements.aiDebriefingAssistantBtn?.addEventListener("click", exportCombined);
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
