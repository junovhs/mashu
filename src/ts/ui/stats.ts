import { formatBytes } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";
import { setSelectionByExtension } from "./tree.js";

const REPORT_YIELD_EVERY = 400;

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

  if (appState.selectionCommitted && elements.selectionSummary) {
    elements.selectionSummary.innerHTML = `Displaying stats for <strong>${allFilesList.length} selected files</strong> and <strong>${allFoldersList.length} selected folders</strong>.`;
    elements.selectionSummary.style.display = "block";
  } else if (elements.selectionSummary) {
    elements.selectionSummary.style.display = "none";
  }

  if (elements.globalStats) {
    elements.globalStats.innerHTML = `
            <div class="stat-item">
              <span class="stat-label">Root Folder</span>
              <span class="stat-value stat-value--name">${directoryData.name}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Files in View</span>
              <span class="stat-value">${allFilesList.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Folders in View</span>
              <span class="stat-value">${allFoldersList.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Size</span>
              <span class="stat-value stat-value--name">${formatBytes(directoryData.totalSize)}</span>
            </div>
        `;
  }

  const sortedTypes = Object.entries(directoryData.fileTypes).sort(
    ([, a], [, b]) => b.size - a.size,
  );

  if (elements.fileTypeTableBody) {
    elements.fileTypeTableBody.innerHTML = sortedTypes
      .map(
        ([ext, typeData]) =>
          `<tr data-ext="${ext}">
            <td><span class="ext-chip" data-ext="${ext}">${ext}</span></td>
            <td>${typeData.count}</td>
            <td>${formatBytes(typeData.size)}</td>
          </tr>`,
      )
      .join("");
  }

  renderExtFilterPills(sortedTypes);
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
  const extState = new Map<string, boolean>();

  pills.innerHTML = sortedTypes
    .slice(0, 12)
    .map(([ext, d]) => `
      <button class="ext-filter-pill" data-ext="${ext}" data-active="false" title="Click to select all ${ext} files">
        <span class="pill-label">${ext}</span>
        <span class="pill-count">${d.count}</span>
      </button>
    `)
    .join("");

  pills.querySelectorAll<HTMLButtonElement>(".ext-filter-pill").forEach((btn) => {
    extState.set(btn.dataset.ext!, false);
    btn.addEventListener("click", () => {
      const ext = btn.dataset.ext!;
      const nowActive = btn.dataset.active !== "true";
      btn.dataset.active = String(nowActive);
      setSelectionByExtension(ext, nowActive);
    });
  });
}

export async function generateTextReportAsync(data: ScanData): Promise<string> {
  if (!data.directoryData) return "// No data for report //";

  const root = data.directoryData;
  const lines = [
    "//--- DirAnalyze Report ---//",
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
    const branch = isRoot ? "" : `${prefix}${isLastChild ? "\\u2514\\u2500 " : "\\u251c\\u2500 "}`;

    if (node.type === "folder") {
      lines.push(`${branch}${node.name}/`);
      const nextPrefix = isRoot
        ? ""
        : `${prefix}${isLastChild ? "    " : "\\u2502   "}`;

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
  return lines
    .join("\n")
    .replaceAll("\\u2514\\u2500", "\u2514\u2500")
    .replaceAll("\\u251c\\u2500", "\u251c\u2500")
    .replaceAll("\\u2502", "\u2502");
}
