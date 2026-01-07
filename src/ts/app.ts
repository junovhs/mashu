// --- CSS IMPORTS (Forces bundling) ---
import "../css/app.css";
import "../css/components.css";
import "../css/tree.css";
import "../css/viewer.css";
import "../css/modals.css";
import "../css/report.css";
import "../css/stats.css";

import { downloadZip, exportCombined, handleImport } from "./features.js";
import type { ScanAggregator } from "./filesystem.js";
import { filterScanData, initTypeData, scanDir } from "./filesystem.js";
import { processScaffold, SCAFFOLD_PROMPT_TEMPLATE } from "./scaffold.js";
import { appState, elements } from "./state.js";
import type { FolderInfo } from "./types/index.js";
import {
  closeScaffoldModal,
  closeViewer,
  disableUIControls,
  enableUIControls,
  initLayout,
  initModals,
  initSidebarResizer,
  initTabs,
  openScaffoldModal,
  populateElements,
  refreshAllUI,
  renderTree,
  resetUIForProcessing,
  setAllSelections,
  showFailedUI,
  showNotification,
  toggleAllFolders,
} from "./ui/index.js";
import { toResult } from "./utils/result.js";

async function verifyAndProcess(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  if (!(await checkPerms(handle))) return;

  resetUIForProcessing(`Processing '${handle.name}'...`);
  appState.directoryHandle = handle;

  const res = await scanDir(handle, handle.name, 0);
  if (!res.ok) {
    showFailedUI("Scan failed.");
    console.error(res.error);
    return;
  }

  await finishScan(handle, res.value);
}

async function checkPerms(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const res = await toResult(handle.queryPermission({ mode: "readwrite" }));
  if (res.ok && res.value === "granted") return true;

  const req = await toResult(handle.requestPermission({ mode: "readwrite" }));
  if (req.ok && req.value === "granted") return true;

  return await checkRead(handle);
}

async function checkRead(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const res = await toResult(handle.queryPermission({ mode: "read" }));
  if (res.ok && res.value === "granted") {
    showNotification("Read-only mode.", 4000);
    return true;
  }

  const req = await toResult(handle.requestPermission({ mode: "read" }));
  if (req.ok && req.value === "granted") {
    showNotification("Read-only mode.", 4000);
    return true;
  }

  showNotification("Read denied.", 4000);
  return false;
}

async function finishScan(handle: FileSystemDirectoryHandle, data: FolderInfo) {
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

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  elements.dropZone?.classList.remove("dragover");
  if (appState.processingInProgress || !event.dataTransfer) return;

  for (const item of Array.from(event.dataTransfer.items)) {
    if (item.kind === "file") {
      const handle = await item.getAsFileSystemHandle();
      if (handle?.kind === "directory") {
        return verifyAndProcess(handle as FileSystemDirectoryHandle);
      }
    }
  }
  showNotification("Error: Please drop a single folder.", 4000);
}

async function handleSelect(): Promise<void> {
  if (appState.processingInProgress) return;
  const result = await toResult(
    window.showDirectoryPicker({ mode: "readwrite" }),
  );
  if (result.ok) {
    await verifyAndProcess(result.value);
  } else if (result.error.name !== "AbortError") {
    showNotification(`Error: ${result.error.message}`, 4000);
  }
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

  elements.importAiScaffoldBtn?.addEventListener("click", openScaffoldModal);
  elements.importFromExportBtn?.addEventListener("click", () =>
    handleImport(verifyAndProcess),
  );
  elements.closeScaffoldModalBtn?.addEventListener("click", closeScaffoldModal);
  elements.createProjectFromScaffoldBtn?.addEventListener("click", () =>
    processScaffold(verifyAndProcess),
  );
  elements.cancelScaffoldImportBtn?.addEventListener(
    "click",
    closeScaffoldModal,
  );
  elements.copyScaffoldPromptBtn?.addEventListener("click", () => {
    navigator.clipboard
      .writeText(SCAFFOLD_PROMPT_TEMPLATE.trim())
      .then(() => showNotification("Scaffold prompt copied!", 3000));
  });
}

async function init(): Promise<void> {
  initLayout();
  initModals();
  populateElements();

  const response = await toResult(fetch("/data/filetypes.json"));
  if (response.ok) {
    const data = await response.value.json();
    initTypeData(data);
  } else {
    console.error("Fatal: Could not load filetypes.json", response.error);
    showNotification("Error: Could not load file type data.", 5000);
  }

  initTabs();
  initSidebarResizer();
  setupListeners();
  disableUIControls();
  elements.pageLoader?.classList.add("hidden");
  console.log("DirAnalyze Streamline (TypeScript) Initialized.");
}

document.addEventListener("DOMContentLoaded", init);
