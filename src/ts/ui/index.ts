import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { displayGlobalStats, generateTextReportAsync } from "./stats.js";
import { closeViewer } from "./viewer.js";

// Export everything so app.ts can find them
export * from "./layout.js";
export * from "./modals.js";
export * from "./stats.js";
export * from "./tree.js";
export * from "./viewer.js";

let reportRefreshToken = 0;

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
  const data = appState.selectionCommitted
    ? appState.committedScanData
    : appState.fullScanData;
  if (!data) return;

  displayGlobalStats(data);
  if (elements.textOutput) {
    const token = ++reportRefreshToken;
    elements.textOutput.textContent = `// PREPARING REPORT FOR ${data.directoryData?.name || "PROJECT"} //`;
    void generateTextReportAsync(data).then((report) => {
      if (token !== reportRefreshToken || !elements.textOutput) return;
      elements.textOutput.textContent = report;
    });
  }
  updateFilter();
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
