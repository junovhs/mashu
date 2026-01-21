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
import { buildFromEntry, buildFromFileList, showFolderPicker } from "./utils/crossbrowser_fs.js";

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
// FULL-PAGE DROP OVERLAY
// ============================================================================

let dragCounter = 0; // Track nested drag events

function showDropOverlay(): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay && !appState.processingInProgress) {
    overlay.classList.add("visible");
  }
}

function hideDropOverlay(): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay) {
    overlay.classList.remove("visible", "drag-over");
  }
}

function setOverlayActive(active: boolean): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay) {
    if (active) {
      overlay.classList.add("drag-over");
    } else {
      overlay.classList.remove("drag-over");
    }
  }
}

function createRipple(x: number, y: number): void {
  const overlay = document.getElementById("fullPageDropOverlay");
  if (!overlay) return;
  
  const ripple = document.createElement("div");
  ripple.className = "drop-ripple active";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  overlay.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

function setupFullPageDrop(): void {
  // Prevent default drag behaviors on document
  document.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
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
    dragCounter = 0;
    hideDropOverlay();
  });

  // Setup the overlay itself for visual feedback
  const overlay = document.getElementById("fullPageDropOverlay");
  if (overlay) {
    overlay.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      setOverlayActive(true);
    });

    overlay.addEventListener("dragleave", (e: DragEvent) => {
      // Only deactivate if leaving to outside the overlay content
      const rect = overlay.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
        setOverlayActive(false);
      }
    });

    overlay.addEventListener("drop", async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // IMPORTANT: Get the entry synchronously before any async operations
      // DataTransferItem becomes invalid after the event handler yields
      let entry: FileSystemEntry | null = null;
      if (e.dataTransfer && !appState.processingInProgress) {
        const items = Array.from(e.dataTransfer.items);
        for (const item of items) {
          if (item.kind === "file") {
            entry = item.webkitGetAsEntry();
            if (entry?.isDirectory) break;
            entry = null;
          }
        }
      }
      
      createRipple(e.clientX, e.clientY);
      
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 150));
      
      dragCounter = 0;
      hideDropOverlay();
      
      if (!entry) {
        if (!appState.processingInProgress) {
          showNotification("Please drop a folder, not a file.", 4000);
        }
        return;
      }
      
      // Now process the entry (this can be async)
      const handle = await buildFromEntry(entry);
      if (handle) {
        return processDirectory(handle);
      }
      
      showNotification("Could not read folder.", 4000);
    });
  }
}

// ============================================================================
// FOLDER SELECT BUTTON (uses <input webkitdirectory> - works in all browsers)
// ============================================================================

async function handleSelect(): Promise<void> {
  console.log("[handleSelect] Called, processingInProgress:", appState.processingInProgress);
  if (appState.processingInProgress) return;
  
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
