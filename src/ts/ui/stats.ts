import { formatBytes } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";

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

  const totalSize = allFilesList.reduce((sum, f) => sum + f.size, 0);

  if (appState.selectionCommitted && elements.selectionSummary) {
    elements.selectionSummary.innerHTML = `Displaying stats for <strong>${allFilesList.length} selected files</strong> and <strong>${allFoldersList.length} selected folders</strong>.`;
    elements.selectionSummary.style.display = "block";
  } else if (elements.selectionSummary) {
    elements.selectionSummary.style.display = "none";
  }

  if (elements.globalStats) {
    elements.globalStats.innerHTML = `
            <div class="stat-item"><strong>Root Folder:</strong> ${directoryData.name}</div>
            <div class="stat-item"><strong>Files in View:</strong> ${allFilesList.length}</div>
            <div class="stat-item"><strong>Folders in View:</strong> ${allFoldersList.length}</div>
            <div class="stat-item"><strong>Total Size (View):</strong> ${formatBytes(totalSize)}</div>
        `;
  }

  const fileTypes: Record<string, { count: number; size: number }> = {};
  allFilesList.forEach((file) => {
    if (!fileTypes[file.extension])
      fileTypes[file.extension] = { count: 0, size: 0 };
    fileTypes[file.extension].count++;
    fileTypes[file.extension].size += file.size;
  });

  const sortedTypes = Object.entries(fileTypes).sort(
    ([, a], [, b]) => b.size - a.size,
  );
  if (elements.fileTypeTableBody) {
    elements.fileTypeTableBody.innerHTML = "";
    sortedTypes.forEach(([ext, typeData]) => {
      const row = (
        elements.fileTypeTableBody as HTMLTableSectionElement
      ).insertRow();
      row.innerHTML = `<td>${ext}</td><td>${typeData.count}</td><td>${formatBytes(typeData.size)}</td>`;
    });
  }
}

export async function generateTextReportAsync(data: ScanData): Promise<string> {
  if (!data.directoryData) return "// NO DATA FOR REPORT //";

  const root = data.directoryData;
  const lines = [
    "//--- DIRANALYSE STREAMLINE REPORT ---//",
    `// Timestamp: ${new Date().toISOString()}`,
    `// Root: ${root.name}`,
    "",
    "//--- DIRECTORY STRUCTURE ---",
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

  lines.push("", "//--- END OF REPORT ---//");
  return lines
    .join("\n")
    .replaceAll("\\u2514\\u2500", "\u2514\u2500")
    .replaceAll("\\u251c\\u2500", "\u251c\u2500")
    .replaceAll("\\u2502", "\u2502");
}
