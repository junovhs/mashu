import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";
import { displayGlobalStats, generateTextReportAsync } from "./stats.js";
import { closeViewer } from "./viewer.js";

// Export everything so app.ts can find them
export * from "./layout.js";
export * from "./modals.js";
export * from "./stats.js";
export * from "./tree.js";
export * from "./viewer.js";

let reportRefreshToken = 0;
let cachedReportKey: string | null = null;
let cachedReportText: string | null = null;
let pendingReportKey: string | null = null;
let pendingReportPromise: Promise<string> | null = null;
let scheduledReportWarmupId: number | null = null;
let renderedReportKey: string | null = null;

export function populateElements(): void {
  const ids = [
    "selectFolderBtn",
    "dropZone",
    "loader",
    "treeContainer",
    "commitSelectionsBtn",
    "textOutput",
    "copyReportButton",
    "selectAllBtn",
    "deselectAllBtn",
    "expandAllBtn",
    "collapseAllBtn",
    "downloadProjectBtn",
    "clearProjectBtn",
    "pageLoader",
    "viewerContent",
    "viewerInfo",
    "viewerFileTitle",
    "closeViewerBtn",
    "fileViewer",
    "mainViewTabs",
    "tabContentArea",
    "sidebarResizer",
    "leftSidebar",
    "aiDebriefingAssistantBtn",
    "fileTypeTableBody",
    "selectionSummary",
    "globalStats",
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) elements[id] = el;
  });

  elements.viewerInfo = elements.viewerInfo as HTMLSpanElement;
  elements.viewerFileTitle = elements.viewerFileTitle as HTMLHeadingElement;
  elements.fileTypeTableBody =
    elements.fileTypeTableBody as HTMLTableSectionElement;
  elements.selectionSummary = elements.selectionSummary as HTMLDivElement;
  elements.globalStats = elements.globalStats as HTMLDivElement;
}

export function showNotification(message: string, duration = 3000): void {
  const note = document.createElement("div");
  note.className = "notification";
  note.textContent = message;
  document.body.appendChild(note);
  setTimeout(() => {
    note.classList.add("fade-out");
    setTimeout(() => note.remove(), 500);
  }, duration);
}

export function resetUIForProcessing(message = "Processing..."): void {
  if (elements.loader) {
    elements.loader.textContent = message;
    elements.loader.classList.add("visible");
  }
  if (elements.treeContainer) elements.treeContainer.innerHTML = "";
  if (elements.textOutput)
    elements.textOutput.textContent = "// NO PROJECT LOADED //";
  closeViewer();
}

export function showFailedUI(message: string): void {
  if (elements.loader) {
    elements.loader.textContent = message;
    elements.loader.classList.add("error");
  }
}

export function initTabs(): void {
  const tabs = elements.mainViewTabs?.querySelectorAll(".tab-button");
  if (!tabs) return;

  tabs.forEach((el: Element) => {
    const button = el as HTMLButtonElement;
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");
      if (tabName) setActiveTab(tabName);
    });
  });
}

function setActiveTab(tabName: string): void {
  appState.activeTabId = tabName;
  const buttons = elements.mainViewTabs?.querySelectorAll(".tab-button");
  buttons?.forEach((el: Element) => {
    const btn = el as HTMLElement;
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });

  const contents =
    elements.tabContentArea?.querySelectorAll(".tab-content-item");
  contents?.forEach((el: Element) => {
    const content = el as HTMLElement;
    const isActive = content.getAttribute("id") === tabName;
    content.classList.toggle("active", isActive);
    content.style.display = isActive ? "flex" : "none";
  });

  if (tabName === "textReportTab") refreshAllUI();
}

export function refreshAllUI(): void {
  const data = getActiveScanData();
  if (!data) return;

  performance.mark("diranalyze:refresh-ui:start");
  displayGlobalStats(data);
  queueReportWarmup(data);
  updateFilter();
  measurePerformance(
    "refresh-ui",
    "diranalyze:refresh-ui:start",
    "diranalyze:refresh-ui:end",
  );
}

export function enableUIControls(enable = true): void {
  const controls = [
    "commitSelectionsBtn",
    "selectAllBtn",
    "deselectAllBtn",
    "expandAllBtn",
    "collapseAllBtn",
    "downloadProjectBtn",
    "clearProjectBtn",
    "copyReportButton",
    "aiDebriefingAssistantBtn",
  ];
  controls.forEach((id) => {
    const btn = elements[id];
    if (!btn) return;

    const requiresCommittedSelection = id === "aiDebriefingAssistantBtn";
    (btn as HTMLButtonElement).disabled =
      !enable || (requiresCommittedSelection && !appState.selectionCommitted);
  });
}

export function disableUIControls(): void {
  enableUIControls(false);
}

export async function copyCurrentReport(): Promise<void> {
  const data = getActiveScanData();
  if (!data) return;

  const reportKey = getReportKey(data);
  const report = await ensureReportText(data, reportKey);
  await navigator.clipboard.writeText(report);
  showNotification("Report copied!", 2000);

  const currentData = getActiveScanData();
  if (
    currentData &&
    getReportKey(currentData) === reportKey &&
    renderedReportKey !== reportKey
  ) {
    setReportPlaceholder(currentData, true);
  }
}

function updateFilter(): void {
  if (!appState.fullScanData || !elements.treeContainer) return;
  const committedPaths = getCommits();

  elements.treeContainer.querySelectorAll("li").forEach((el: Element) => {
    const li = el as HTMLElement;
    const path = li.dataset.path || "";
    li.classList.remove("dimmed-uncommitted");
    if (
      appState.selectionCommitted &&
      committedPaths.size > 0 &&
      !committedPaths.has(path)
    ) {
      li.classList.add("dimmed-uncommitted");
    }
  });
}

function getCommits(): Set<string> {
  const paths = new Set<string>();
  if (
    appState.selectionCommitted &&
    appState.committedScanData?.directoryData
  ) {
    const walk = (node: FolderInfo | FileInfo) => {
      paths.add(node.path);
      if (node.type === "folder") node.children.forEach(walk);
    };
    walk(appState.committedScanData.directoryData);
  }
  return paths;
}

function getActiveScanData(): ScanData | null {
  return appState.selectionCommitted
    ? appState.committedScanData
    : appState.fullScanData;
}

function getReportKey(data: ScanData): string {
  const root = data.directoryData;
  if (!root) return "empty";

  return [
    appState.selectionCommitted ? "committed" : "full",
    root.path,
    data.allFilesList.length,
    data.allFoldersList.length,
    root.totalSize,
  ].join("|");
}

function queueReportWarmup(data: ScanData): void {
  if (!elements.textOutput) return;

  const reportKey = getReportKey(data);
  renderedReportKey = null;

  if (scheduledReportWarmupId !== null) {
    window.clearTimeout(scheduledReportWarmupId);
    scheduledReportWarmupId = null;
  }

  if (cachedReportKey === reportKey && cachedReportText !== null) {
    setReportPlaceholder(data, true);
    return;
  }

  setReportPlaceholder(data, false);
  const token = ++reportRefreshToken;

  scheduledReportWarmupId = window.setTimeout(() => {
    scheduledReportWarmupId = null;
    void ensureReportText(data, reportKey).then(() => {
      const currentData = getActiveScanData();
      if (
        token !== reportRefreshToken ||
        !currentData ||
        getReportKey(currentData) !== reportKey
      ) {
        return;
      }

      if (renderedReportKey === reportKey) {
        setReportPlaceholder(currentData, true);
        return;
      }

      void scheduleRenderedReport(currentData, reportKey);
    });
  }, 250);
}

function setReportPlaceholder(data: ScanData, isReady: boolean): void {
  if (!elements.textOutput || !data.directoryData) return;

  const root = data.directoryData;
  const statusLine = isReady
    ? "// REPORT READY. CLICK SHOW REPORT TO RENDER OR COPY REPORT TO COPY. //"
    : "// REPORT CACHE WARMING IN BACKGROUND. //";

  elements.textOutput.textContent = [
    `// PROJECT: ${root.name}`,
    `// FILES IN VIEW: ${data.allFilesList.length}`,
    `// FOLDERS IN VIEW: ${data.allFoldersList.length}`,
    `// TOTAL SIZE: ${root.totalSize} BYTES`,
    "",
    statusLine,
  ].join("\n");
}

async function ensureReportText(
  data: ScanData,
  reportKey: string,
): Promise<string> {
  if (cachedReportKey === reportKey && cachedReportText !== null) {
    return cachedReportText;
  }

  if (pendingReportKey === reportKey && pendingReportPromise) {
    return pendingReportPromise;
  }

  performance.mark("diranalyze:report-generate:start");
  pendingReportKey = reportKey;
  pendingReportPromise = generateTextReportAsync(data)
    .then((report) => {
      if (pendingReportKey === reportKey) {
        cachedReportKey = reportKey;
        cachedReportText = report;
        pendingReportKey = null;
        pendingReportPromise = null;
      }

      measurePerformance(
        "report-generate",
        "diranalyze:report-generate:start",
        "diranalyze:report-generate:end",
      );
      return report;
    })
    .catch((error) => {
      if (pendingReportKey === reportKey) {
        pendingReportKey = null;
        pendingReportPromise = null;
      }
      throw error;
    });

  return pendingReportPromise;
}

async function scheduleRenderedReport(
  data: ScanData,
  reportKey: string,
): Promise<void> {
  await waitForNextFrame();

  const currentData = getActiveScanData();
  if (!currentData || getReportKey(currentData) !== reportKey) {
    return;
  }

  const report = await ensureReportText(data, reportKey);
  const latestData = getActiveScanData();
  if (!latestData || getReportKey(latestData) !== reportKey) {
    return;
  }

  applyRenderedReport(reportKey, report);
}

function applyRenderedReport(reportKey: string, report: string): void {
  if (!elements.textOutput) return;

  renderedReportKey = reportKey;
  elements.textOutput.textContent = report;
}

async function waitForNextFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function measurePerformance(
  name: string,
  startMark: string,
  endMark: string,
): void {
  performance.mark(endMark);
  try {
    performance.measure(`diranalyze:${name}`, startMark, endMark);
    const entries = performance.getEntriesByName(`diranalyze:${name}`, "measure");
    const latest = entries.at(-1);
    if (latest) {
      console.info(`[perf] ${name}: ${latest.duration.toFixed(1)}ms`);
    }
  } catch {
    // Ignore measurement failures in browsers with limited Performance APIs.
  }
}
