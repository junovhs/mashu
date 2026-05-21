// --- CSS IMPORTS (Forces bundling) ---
import "../css/app.css";
import "../css/components.css";
import "../css/tree.css";
import "../css/viewer.css";
import "../css/modals.css";
import "../css/report.css";
import "../css/stats.css";
import "../css/dropoverlay.css";
import "../css/extensions.css";

import { downloadZip, exportCombined } from "./features.js";
import type { ScanAggregator } from "./filesystem.js";
import { formatBytes, initTypeData, scanDir, scanFileList } from "./filesystem.js";
import { appState, elements } from "./state.js";
import type { FolderInfo, ScanData, SerializableEntry, SerializableFileEntry, SerializableFolderEntry, WorkerOutboundMessage } from "./types/index.js";
import {
  applyRustSelectionState,
  closeViewer,
  copyCurrentReport,
  disableUIControls,
  enableUIControls,
  initTreeState,
  initLayout,
  initPretextText,
  initSidebarResizer,
  initTabs,
  populateElements,
  refreshAllUI,
  renderTree,
  resetUIForProcessing,
  saveCurrentReport,
  setAllSelections,
  showFailedUI,
  showNotification,
  toggleAllFolders,
} from "./ui/index.js";
import type { VirtualDirectoryHandle } from "./utils/crossbrowser_fs.js";
import { buildFromEntry, showFolderPicker } from "./utils/crossbrowser_fs.js";

const RECENT_PROJECTS_STORAGE_KEY = "mashu:recent-projects";
const MAX_RECENT_PROJECTS = 3;

interface RecentProjectSummary {
  fileCount: number;
  name: string;
  openedAt: string;
  path: string;
  totalSize: number;
}

async function processDirectory(handle: VirtualDirectoryHandle): Promise<void> {
  performance.mark("mashu:process-directory:start");
  appState.processingInProgress = true;
  resetUIForProcessing(`Processing '${handle.name}'...`);
  disableUIControls();

  await finishScan(handle);
}

async function processFileList(files: FileList): Promise<void> {
  performance.mark("mashu:process-directory:start");
  appState.processingInProgress = true;

  const rootName = getFileListRootName(files) || "PROJECT";
  resetUIForProcessing(`Processing '${rootName}'...`);
  disableUIControls();

  performance.mark("mashu:scan-file-list:start");
  const scanRes = await scanFileList(files);
  logPerfMeasure(
    "scan-file-list",
    "mashu:scan-file-list:start",
    "mashu:scan-file-list:end",
  );

  if (scanRes.ok) {
    const root = scanRes.value.directoryData;
    console.info(`[counts] files:${scanRes.value.allFilesList.length} folders:${scanRes.value.allFoldersList.length} ignored:0 bytes:${root?.totalSize ?? 0}`);
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
  performance.mark("mashu:scan:start");
  const agg: ScanAggregator = {
    allFilesList: [],
    allFoldersList: [],
    ignoredCount: 0,
    maxDepth: 0,
  };
  const scanRes = await scanDir(handle, handle.name, 0, agg);
  logPerfMeasure("scan", "mashu:scan:start", "mashu:scan:end");
  if (scanRes.ok) {
    console.info(`[counts] files:${agg.allFilesList.length} folders:${agg.allFoldersList.length} ignored:${agg.ignoredCount} bytes:${scanRes.value.totalSize}`);
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
  saveRecentProjectSummary(data);
  document.body.classList.add("project-loaded");
  postScanBatchToWorker(data);
  updateUI(appState.fullScanData.directoryData as FolderInfo);
}

function updateUI(data: FolderInfo) {
  performance.mark("mashu:update-ui:start");
  const container = elements.treeContainer;
  if (container) {
    performance.mark("mashu:init-tree-state:start");
    initTreeState(data, {
      initialCollapsed: true,
      initialSelected: false,
      expandRootOnly: true,
    });
    logPerfMeasure("init-tree-state", "mashu:init-tree-state:start", "mashu:init-tree-state:end");

    performance.mark("mashu:render-tree:start");
    container.innerHTML = "";
    renderTree(data, container);
    logPerfMeasure("render-tree", "mashu:render-tree:start", "mashu:render-tree:end");

    refreshAllUI();
    enableUIControls();
    logPerfMeasure(
      "update-ui",
      "mashu:update-ui:start",
      "mashu:update-ui:end",
    );
    requestAnimationFrame(() => {
      logPerfMeasure(
        "visible-load",
        "mashu:process-directory:start",
        "mashu:visible-load:end",
      );
      const sd = appState.fullScanData;
      if (sd) {
        console.info(`[counts] rendered-rows:${sd.allFilesList.length + sd.allFoldersList.length} selected:${appState.selectedPaths.size} bytes:${sd.directoryData?.totalSize ?? 0}`);
      }
    });
  }
}

function clearProject(): void {
  appState.fullScanData = null;
  appState.treeSearchQuery = "";
  document.body.classList.remove("project-loaded");
  appState.expandedFolderPaths.clear();
  appState.selectedPaths.clear();
  appState.treeNodesByPath.clear();
  appState.treeParentPaths.clear();
  appState.subtreeNodeCounts.clear();
  appState.selectedSubtreeCounts.clear();
  appState.processingInProgress = false;
  resetUIForProcessing();
  const loader = elements.loader;
  if (loader) loader.classList.remove("visible");
  enableUIControls(false);
  renderEmptyShell();
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

    performance.mark("mashu:build-handle:start");
    void buildFromEntry(entry).then((handle) => {
      logPerfMeasure(
        "build-handle",
        "mashu:build-handle:start",
        "mashu:build-handle:end",
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

  document.addEventListener("click", (event: MouseEvent) => {
    if (!appState.isViewerActive) return;

    const target = event.target;
    const viewer = elements.fileViewer as HTMLElement | undefined;
    const leftSidebar = elements.leftSidebar as HTMLElement | undefined;
    if (!(target instanceof HTMLElement) || !viewer) return;
    if (viewer.contains(target)) return;
    if (leftSidebar?.contains(target)) return;

    closeViewer();
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "/" || !appState.fullScanData) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }

    event.preventDefault();
    (elements.treeSearchInput as HTMLInputElement | undefined)?.focus();
  });

  window.addEventListener("mashu:selection-changed", () => {
    refreshAllUI();
    enableUIControls();
  });

  elements.dropZone?.addEventListener("click", (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("#selectFolderBtn")) {
      return;
    }
    void handleSelect();
  });
  elements.selectFolderBtn?.addEventListener("click", handleSelect);
  elements.treeSearchInput?.addEventListener("input", (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    appState.treeSearchQuery = target.value;
    const root = appState.fullScanData?.directoryData;
    const container = elements.treeContainer as HTMLElement | undefined;
    if (!root || !container) return;

    container.innerHTML = "";
    renderTree(root, container);
  });
  elements.downloadProjectBtn?.addEventListener("click", async () => {
    performance.mark("mashu:export-zip:start");
    await downloadZip();
    logPerfMeasure("export-zip", "mashu:export-zip:start", "mashu:export-zip:end");
  });
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
  elements.saveReportButton?.addEventListener("click", () => {
    void saveCurrentReport();
  });
  elements.closeViewerBtn?.addEventListener("click", closeViewer);
  elements.aiDebriefingAssistantBtn?.addEventListener("click", async () => {
    performance.mark("mashu:export-combined:start");
    await exportCombined();
    logPerfMeasure("export-combined", "mashu:export-combined:start", "mashu:export-combined:end");
  });
}

function renderEmptyShell(): void {
  const scopePath = document.getElementById("scopePath");
  const scopeMeta = document.getElementById("scopeMeta");
  const sideSelected = document.getElementById("sideSelected");
  const barInfo = document.getElementById("barInfo");

  if (scopePath) {
    scopePath.innerHTML = `<span class="scope-empty pretext-flow" data-pretext>NO PROJECT LOADED</span>`;
  }
  if (scopeMeta) {
    scopeMeta.innerHTML = "";
  }
  if (sideSelected) {
    sideSelected.textContent = "";
  }
  if (barInfo) {
    barInfo.innerHTML = `<span class="pretext-flow" data-pretext>Awaiting a folder…</span>`;
  }
  const searchInput = elements.treeSearchInput as HTMLInputElement | undefined;
  if (searchInput) {
    searchInput.value = "";
  }

  renderRecentProjects();
}

function renderRecentProjects(): void {
  const recentProjects = document.getElementById("recentProjects");
  const list = document.getElementById("recentProjectsList");
  if (!recentProjects || !list) return;

  const recents = getRecentProjectSummaries();
  recentProjects.setAttribute("data-empty", recents.length === 0 ? "true" : "false");

  if (recents.length === 0) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = recents
    .map((item) => `
      <div class="recent-project-row">
        <span class="recent-project-name">${escapeHtml(item.name)}</span>
        <span class="recent-project-meta">${formatRecentMeta(item)}</span>
      </div>
    `)
    .join("");
}

function getRecentProjectSummaries(): RecentProjectSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isRecentProjectSummary).slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

function isRecentProjectSummary(value: unknown): value is RecentProjectSummary {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<RecentProjectSummary>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.openedAt === "string" &&
    typeof candidate.fileCount === "number" &&
    typeof candidate.totalSize === "number"
  );
}

function saveRecentProjectSummary(data: ScanData): void {
  const root = data.directoryData;
  if (!root) return;

  const summary: RecentProjectSummary = {
    fileCount: data.allFilesList.length,
    name: root.name,
    openedAt: new Date().toISOString(),
    path: root.path,
    totalSize: root.totalSize,
  };

  const existing = getRecentProjectSummaries().filter((item) => item.path !== summary.path);
  const next = [summary, ...existing].slice(0, MAX_RECENT_PROJECTS);

  try {
    localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures and keep the rest of the app working.
  }

  renderRecentProjects();
}

function formatRecentMeta(item: RecentProjectSummary): string {
  return `${item.fileCount} files · ${formatBytes(item.totalSize)} · ${formatRelativeTime(item.openedAt)}`;
}

function formatRelativeTime(isoTime: string): string {
  const diffMs = Date.now() - Date.parse(isoTime);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "recently";

  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 48) return "yesterday";

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] as string));
}

function logPerfMeasure(name: string, startMark: string, endMark: string): void {
  performance.mark(endMark);
  try {
    performance.measure(`mashu:${name}`, startMark, endMark);
    const entries = performance.getEntriesByName(`mashu:${name}`, "measure");
    const latest = entries.at(-1);
    if (latest) {
      console.info(`[perf] ${name}: ${latest.duration.toFixed(1)}ms`);
    }
  } catch {
    // Ignore measurement failures when the browser drops a mark.
  }
}

function buildSerializableEntries(data: ScanData): SerializableEntry[] {
  const entries: SerializableEntry[] = [];
  for (const f of data.allFilesList) {
    const e: SerializableFileEntry = {
      id: f.path,
      kind: "file",
      name: f.name,
      path: f.path,
      size: f.size,
      extension: f.extension,
      depth: f.depth,
    };
    entries.push(e);
  }
  for (const folder of data.allFoldersList) {
    const depth = folder.path.split("/").length - 1;
    const e: SerializableFolderEntry = {
      id: folder.path,
      kind: "folder",
      name: folder.name,
      path: folder.path,
      depth,
    };
    entries.push(e);
  }
  return entries;
}

function postScanBatchToWorker(data: ScanData): void {
  if (!scanWorker) return;
  const entries = buildSerializableEntries(data);
  const batchId = Date.now().toString(36);
  scanWorker.postMessage({ type: "scan-batch", batchId, entries });
  console.info(`[worker] scan-batch sent batchId=${batchId} entries=${entries.length}`);
}

let scanWorker: Worker | null = null;

function initWorker(): void {
  try {
    scanWorker = new Worker(
      new URL("./workers/scan.worker.ts", import.meta.url),
      { type: "module" },
    );
    scanWorker.addEventListener("message", (event: MessageEvent<WorkerOutboundMessage>) => {
      const msg = event.data;
      if (msg.type === "pong") {
        console.info("[worker] ready");
      } else if (msg.type === "scan-result") {
        console.info(`[worker] scan-result batchId=${msg.batchId} ok=${msg.ok}`);
      } else if (msg.type === "stats-ready") {
        appState.rustIndexReady = msg.rustIndexReady;
        const main = appState.fullScanData?.directoryData;
        const fileMatch = main ? msg.tree.fileCount === main.fileCount : null;
        const sizeMatch = main ? msg.tree.totalSize === main.totalSize : null;
        console.info(
          `[worker] stats-ready batchId=${msg.batchId}` +
          ` files=${msg.tree.fileCount}(parity=${fileMatch})` +
          ` bytes=${msg.tree.totalSize}(parity=${sizeMatch})` +
          ` rustIndex=${msg.rustIndexReady}`,
        );
      } else if (msg.type === "selection-state-ready") {
        applyRustSelectionState(msg.selectedSubtreeCounts, msg.selectedFolderPaths);
      }
    });
    scanWorker.addEventListener("error", (e) => {
      console.warn("[worker] error:", e.message);
    });
    appState.scanWorker = scanWorker;
  } catch (e) {
    console.warn("[worker] could not start, running without worker:", e);
  }
}

async function init() {
  initLayout();
  populateElements();
  initTabs();
  initSidebarResizer();
  initPretextText();
  setupHiddenInput();
  initWorker();

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
  renderEmptyShell();
  console.log("Mashu (Cross-Browser) Initialized.");
}

document.addEventListener("DOMContentLoaded", init);
