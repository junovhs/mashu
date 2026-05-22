import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";
import { filterScanData, formatBytes } from "../filesystem.js";
import { displayGlobalStats, generateTextReportAsync, refreshSelectionStats, resetStatsCache } from "./stats.js";
import { closeViewer } from "./viewer.js";

// Export everything so app.ts can find them
export * from "./layout.js";
export * from "./modals.js";
export * from "./stats.js";
export * from "./tree.js";
export * from "./viewer.js";

let cachedReportKey: string | null = null;
let cachedReportText: string | null = null;
let pendingReportKey: string | null = null;
let pendingReportPromise: Promise<string> | null = null;
let cachedVisualKey: string | null = null;
let cachedVisualNode: HTMLElement | null = null;

export function populateElements(): void {
  const ids = [
    "selectFolderBtn",
    "dropZone",
    "loader",
    "treeSearchInput",
    "treeContainer",
    "textOutput",
    "copyReportButton",
    "saveReportButton",
    "selectAllBtn",
    "deselectAllBtn",
    "expandAllBtn",
    "collapseAllBtn",
    "downloadProjectBtn",
    "clearProjectBtn",
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

function getIdleReportMessage(): string {
  return [
    "// Load a folder to start. //",
    "// Mashu scans locally in your browser and shows a tree, stats, and a plain-text report. //",
    "// Select files or folders to instantly focus the report, stats, and export actions. //",
  ].join("\n");
}

export function resetUIForProcessing(message = "Processing..."): void {
  cachedVisualKey = null;
  cachedVisualNode = null;
  resetStatsCache();
  if (elements.loader) {
    (elements.loader as HTMLElement).textContent = message;
    elements.loader.classList.add("visible");
  }
  if (elements.treeContainer) {
    elements.treeContainer.innerHTML = `<div class="tree-loading"><span class="tree-loading-label">${message}</span><div class="tree-loading-bar"><div class="tree-loading-bar-fill"></div></div></div>`;
  }
  if (elements.textOutput) {
    renderReportPlaceholder(getIdleReportMessage());
  }
  closeViewer();
}

export function showFailedUI(message: string): void {
  if (elements.loader) {
    (elements.loader as HTMLElement).textContent = message;
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

export function activateTab(tabName: string): void {
  setActiveTab(tabName);
}

export function refreshAllUI(): void {
  const data = getActiveScanData();
  if (!data) return;

  performance.mark("mashu:refresh-ui:start");
  displayGlobalStats(data);
  renderVisualReport(data);
  measurePerformance(
    "refresh-ui",
    "mashu:refresh-ui:start",
    "mashu:refresh-ui:end",
  );
}

export function refreshSelectionUI(): void {
  const data = getActiveScanData();
  if (!data) return;
  refreshSelectionStats();
  renderVisualReport(data);
}

export function enableUIControls(enable = true): void {
  const controls = [
    "selectAllBtn",
    "deselectAllBtn",
    "expandAllBtn",
    "collapseAllBtn",
    "downloadProjectBtn",
    "clearProjectBtn",
    "copyReportButton",
    "saveReportButton",
    "aiDebriefingAssistantBtn",
  ];
  controls.forEach((id) => {
    const btn = elements[id];
    if (!btn) return;
    (btn as HTMLButtonElement).disabled = !enable;
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
  console.info(`[counts] export-bytes:${report.length} selected:${appState.selectedPaths.size}`);
  await navigator.clipboard.writeText(report);
  showNotification("Report copied!", 2000);
}

export async function saveCurrentReport(): Promise<void> {
  const data = getActiveScanData();
  if (!data?.directoryData) return;

  const reportKey = getReportKey(data);
  const report = await ensureReportText(data, reportKey);
  console.info(`[counts] export-bytes:${report.length} selected:${appState.selectedPaths.size}`);
  const selectionSuffix =
    appState.selectedPaths.size > 0 ? "-selection" : "";
  const filename = `${data.directoryData.name}${selectionSuffix}-report.txt`;

  const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showNotification("Report saved!", 2000);
}

function getActiveScanData(): ScanData | null {
  if (!appState.fullScanData) return null;
  if (appState.selectedPaths.size === 0) return appState.fullScanData;

  return filterScanData(appState.fullScanData, new Set(appState.selectedPaths));
}

function getReportKey(data: ScanData): string {
  const root = data.directoryData;
  if (!root) return "empty";

  return [
    appState.selectedPaths.size > 0 ? "selected" : "full",
    root.path,
    data.allFilesList.length,
    data.allFoldersList.length,
    root.totalSize,
  ].join("|");
}

function renderVisualReport(data: ScanData): void {
  if (!elements.textOutput || !data.directoryData) return;

  const host = elements.textOutput as HTMLElement;
  const key = getReportKey(data);

  // If the DOM node for this key is already in the host, nothing to do.
  if (key === cachedVisualKey && cachedVisualNode) {
    if (host.firstChild !== cachedVisualNode) {
      host.className = "report-visual-host";
      host.removeAttribute("title");
      host.replaceChildren(cachedVisualNode);
    }
    return;
  }

  cachedVisualKey = key;
  const root = data.directoryData;
  const isSelection = appState.selectedPaths.size > 0;
  host.className = "report-visual-host";
  host.removeAttribute("title");

  const visual = document.createElement("div");
  visual.className = "report-visual";

  const summaryRow = document.createElement("div");
  summaryRow.className = "report-summary-row";

  const projectMeta = document.createElement("div");
  projectMeta.className = "report-summary-meta";
  projectMeta.textContent = `project ${root.name}    files ${data.allFilesList.length}    size ${formatBytes(root.totalSize)}`;

  const scopeMeta = document.createElement("div");
  scopeMeta.className = "report-summary-scope";
  scopeMeta.textContent = `scope ${isSelection ? "SELECTION" : "FULL"}`;

  const divider = document.createElement("div");
  divider.className = "report-summary-divider";

  summaryRow.appendChild(projectMeta);
  summaryRow.appendChild(scopeMeta);

  visual.appendChild(summaryRow);
  visual.appendChild(divider);

  const MAX_VISUAL_NODES = 2000;
  if (data.allFilesList.length > MAX_VISUAL_NODES) {
    const tree = document.createElement("ul");
    tree.className = "report-tree";
    const { truncated } = appendShallowTree(root, tree);
    visual.appendChild(tree);
    const note = document.createElement("div");
    note.className = "report-tree-abbreviated-note";
    const truncatedSuffix = truncated > 0 ? `, +${truncated.toLocaleString()} more not shown` : "";
    note.textContent = `Top-level only${truncatedSuffix} — ${data.allFilesList.length.toLocaleString()} files total`;
    visual.appendChild(note);
  } else {
    const tree = document.createElement("ul");
    tree.className = "report-tree";
    appendVisualTreeNode(root, tree, true, [], true);
    visual.appendChild(tree);
  }

  cachedVisualNode = visual;
  host.replaceChildren(visual);
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

  performance.mark("mashu:report-generate:start");
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
        "mashu:report-generate:start",
        "mashu:report-generate:end",
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

function renderReportPlaceholder(text: string): void {
  if (!elements.textOutput) return;

  const host = elements.textOutput as HTMLElement;
  host.className = "report-placeholder";
  host.replaceChildren();

  const copy = document.createElement("div");
  copy.className = "report-placeholder-copy";
  copy.textContent = text;
  host.appendChild(copy);
}

const MAX_SHALLOW_ROWS = 50;

function appendShallowTree(root: FolderInfo, parent: HTMLUListElement): { truncated: number } {
  const children = root.children ?? [];
  const visible = children.slice(0, MAX_SHALLOW_ROWS);
  const truncated = children.length - visible.length;

  // Render root manually (isRoot=true, no elbow)
  appendVisualTreeNode(root, parent, true, [], true);
  const rootItem = parent.firstElementChild as HTMLLIElement | null;
  if (!rootItem) return { truncated };

  const childList = rootItem.querySelector("ul.report-tree-children");
  if (!childList) return { truncated };

  // Remove all auto-rendered children, re-render only the visible slice
  childList.replaceChildren();
  visible.forEach((child, i) => {
    const isLast = i === visible.length - 1 && truncated === 0;
    appendVisualTreeNode(child, childList as HTMLUListElement, false, [false], isLast);
  });

  // Strip any grandchildren from what we just added
  childList.querySelectorAll("ul.report-tree-children").forEach((ul) => ul.remove());

  return { truncated };
}

function appendVisualTreeNode(
  node: FolderInfo | FileInfo,
  parent: HTMLUListElement,
  isRoot = false,
  ancestorContinuations: boolean[] = [],
  isLast = true,
): void {
  const item = document.createElement("li");
  item.className = `report-tree-node report-tree-node--${node.type}${isRoot ? " report-tree-node--root" : ""}`;

  const row = document.createElement("div");
  row.className = `report-tree-row${isRoot ? " report-tree-row--root" : ""}`;

  if (!isRoot) {
    const gutter = document.createElement("div");
    gutter.className = "report-tree-gutter";

    ancestorContinuations.forEach((continues) => {
      const connector = createReportTreeConnector("continuation", continues);
      gutter.appendChild(connector);
    });

    const elbow = createReportTreeConnector("elbow", !isLast);
    gutter.appendChild(elbow);

    row.appendChild(gutter);
  }

  const content = document.createElement("div");
  content.className = "report-tree-content";

  const name = document.createElement("span");
  name.className = "report-tree-name";
  name.textContent = node.type === "folder" ? `${node.name}/` : node.name;

  const meta = document.createElement("span");
  meta.className = "report-tree-meta";
  meta.textContent =
    node.type === "folder"
      ? `${node.fileCount} files, ${formatBytes(node.totalSize)}`
      : formatBytes(node.size);

  content.appendChild(name);
  content.appendChild(meta);
  row.appendChild(content);
  item.appendChild(row);

  if (node.type === "folder" && node.children.length > 0) {
    const children = document.createElement("ul");
    children.className = "report-tree-children";

    node.children.forEach((child, index) => {
      appendVisualTreeNode(
        child,
        children,
        false,
        [...ancestorContinuations, !isLast],
        index === node.children.length - 1,
      );
    });

    item.appendChild(children);
  }

  parent.appendChild(item);
}

function createReportTreeConnector(
  kind: "continuation" | "elbow",
  continues: boolean,
): HTMLDivElement {
  const div = document.createElement("div");
  if (kind === "continuation") {
    div.className = continues ? "rtc rtc-pipe" : "rtc";
  } else {
    div.className = continues ? "rtc rtc-tee" : "rtc rtc-elbow";
  }
  return div;
}

function measurePerformance(
  name: string,
  startMark: string,
  endMark: string,
): void {
  performance.mark(endMark);
  try {
    performance.measure(`mashu:${name}`, startMark, endMark);
    const entries = performance.getEntriesByName(`mashu:${name}`, "measure");
    const latest = entries.at(-1);
    if (latest) {
      console.info(`[perf] ${name}: ${latest.duration.toFixed(1)}ms`);
    }
  } catch {
    // Ignore measurement failures in browsers with limited Performance APIs.
  }
}
