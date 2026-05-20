import { formatBytes } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";
import { setPretextText, syncPretextTree } from "./pretext.js";
import { setSelectionByExtension } from "./tree.js";

const REPORT_YIELD_EVERY = 400;
const TREE_BRANCH = {
  elbow: "└──  ",
  tee: "├──  ",
  pipe: "│   ",
};

interface TextTreeFrame {
  isLastChild: boolean;
  isRoot: boolean;
  node: FileInfo | FolderInfo;
  prefix: string;
}

async function yieldToMainThread(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function displayGlobalStats(data: ScanData): void {
  const { directoryData, allFilesList, allFoldersList } = data;
  if (!directoryData) return;

  if (appState.selectedPaths.size > 0 && elements.selectionSummary) {
    elements.selectionSummary.dataset.pretext = "";
    elements.selectionSummary.classList.add("pretext-flow");
    setPretextText(
      elements.selectionSummary,
      `Focused view active: stats, report, and export now use ${allFilesList.length} selected files and ${allFoldersList.length} selected folders.`,
    );
    elements.selectionSummary.style.display = "block";
  } else if (elements.selectionSummary) {
    elements.selectionSummary.style.display = "none";
  }

  if (elements.globalStats) {
    elements.globalStats.innerHTML = `
            <div class="stat-item">
              <span class="stat-label pretext-flow" data-pretext>Root Folder</span>
              <span class="stat-value stat-value--name pretext-flow" data-pretext>${directoryData.name}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label pretext-flow" data-pretext>Files in View</span>
              <span class="stat-value pretext-flow" data-pretext>${allFilesList.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label pretext-flow" data-pretext>Folders in View</span>
              <span class="stat-value pretext-flow" data-pretext>${allFoldersList.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label pretext-flow" data-pretext>Total Size</span>
              <span class="stat-value stat-value--name pretext-flow" data-pretext>${formatBytes(directoryData.totalSize)}</span>
            </div>
        `;
  }

  const filterSource =
    appState.fullScanData?.directoryData?.fileTypes || directoryData.fileTypes;
  const sortedTypes = Object.entries(filterSource).sort(
    ([, a], [, b]) => b.size - a.size,
  );

  if (elements.fileTypeTableBody) {
    elements.fileTypeTableBody.innerHTML = sortedTypes
      .map(
        ([ext, typeData]) =>
          `<tr data-ext="${ext}">
            <td><span class="ext-chip" data-ext="${ext}">${ext}</span></td>
            <td><span class="table-cell-text pretext-flow" data-pretext>${typeData.count}</span></td>
            <td><span class="table-cell-text pretext-flow" data-pretext>${formatBytes(typeData.size)}</span></td>
          </tr>`,
      )
      .join("");
  }

  renderExtFilterPills(sortedTypes);
  syncPretextTree(document.getElementById("rightStatsPanel") ?? document);
}

function renderExtFilterPills(sortedTypes: [string, { count: number; size: number }][]): void {
  const bar = document.getElementById("extFilterBar");
  const pills = document.getElementById("extPills");
  if (!bar || !pills) return;

  if (sortedTypes.length === 0) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "block";

  pills.innerHTML = sortedTypes
      .slice(0, 12)
      .map(([ext, d]) => `
      <button class="ext-filter-pill" data-ext="${ext}" data-active="${isExtensionFullySelected(ext)}" title="Toggle selection for every ${ext || "[no extension]"} file in the tree">
        <span class="pill-label pretext-flow" data-pretext>${ext || "[none]"}</span>
        <span class="pill-count pretext-flow" data-pretext>${d.count}</span>
      </button>
    `)
    .join("");

  pills.querySelectorAll<HTMLButtonElement>(".ext-filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ext = btn.dataset.ext!;
      const nowActive = btn.dataset.active !== "true";
      btn.dataset.active = String(nowActive);
      setSelectionByExtension(ext, nowActive);
    });
  });
}

function isExtensionFullySelected(ext: string): boolean {
  const fullData = appState.fullScanData;
  if (!fullData) return false;

  const matchingFiles = fullData.allFilesList.filter((file) => file.extension === ext);
  if (matchingFiles.length === 0) return false;

  return matchingFiles.every((file) => appState.selectedPaths.has(file.path));
}

export async function generateTextReportAsync(data: ScanData): Promise<string> {
  if (!data.directoryData) return "// No data for report //";

  const root = data.directoryData;
  const lines = [
    "//--- Mashu Report ---//",
    `// Timestamp: ${new Date().toISOString()}`,
    `// Root: ${root.name}`,
    "",
    "//--- Directory structure ---",
  ];

  const stack: TextTreeFrame[] = [
    {
      isLastChild: true,
      isRoot: true,
      node: root,
      prefix: "",
    },
  ];

  let processedNodes = 0;
  while (stack.length > 0) {
    const frame = stack.pop() as TextTreeFrame;
    const { node, prefix, isRoot, isLastChild } = frame;
    const branch = isRoot
      ? ""
      : `${prefix}${isLastChild ? TREE_BRANCH.elbow : TREE_BRANCH.tee}`;

    if (node.type === "folder") {
      lines.push(`${branch}${node.name}/`);
      const nextPrefix = isRoot
        ? ""
        : `${prefix}${isLastChild ? "    " : TREE_BRANCH.pipe}`;

      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({
          isLastChild: i === node.children.length - 1,
          isRoot: false,
          node: node.children[i],
          prefix: nextPrefix,
        });
      }
    } else {
      lines.push(`${branch}${node.name} (${formatBytes(node.size)})`);
    }

    processedNodes++;
    if (processedNodes % REPORT_YIELD_EVERY === 0) {
      await yieldToMainThread();
    }
  }

  lines.push("", "//--- End of report ---//");
  return lines.join("\n");
}
