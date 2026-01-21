import { formatBytes } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { ScanData } from "../types/index.js";

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
    sortedTypes.forEach(([ext, data]) => {
      const row = (
        elements.fileTypeTableBody as HTMLTableSectionElement
      ).insertRow();
      row.innerHTML = `<td>${ext}</td><td>${data.count}</td><td>${formatBytes(data.size)}</td>`;
    });
  }
}

export function generateTextReport(data: ScanData): string {
  if (!data.directoryData) return "// NO DATA FOR REPORT //";

  const root = data.directoryData;
  let report = `//--- DIRANALYSE STREAMLINE REPORT ---//\n`;
  report += `// Timestamp: ${new Date().toISOString()}\n`;
  report += `// Root: ${root.name}\n\n`;
  report += `//--- DIRECTORY STRUCTURE ---\n`;

  report += buildTextTree(root, "", true);
  report += `\n//--- END OF REPORT ---//`;
  return report;
}

interface TextTreeNode {
  name: string;
  type: "folder" | "file";
  children?: Array<TextTreeNode>;
  size?: number;
  isLastChild?: boolean;
}

function buildTextTree(
  node: TextTreeNode,
  prefix = "",
  isRoot = false,
): string {
  let entry = isRoot ? "" : prefix + (node.isLastChild ? "└─ " : "├─ ");
  entry += node.name;

  if (node.type === "folder") {
    entry += "/\n";
    const children = node.children || [];
    children.forEach((child, index) => {
      child.isLastChild = index === children.length - 1;
      const childPrefix = isRoot
        ? ""
        : prefix + (node.isLastChild ? "    " : "│   ");
      entry += buildTextTree(child, childPrefix, false);
    });
  } else {
    entry += ` (${formatBytes(node.size || 0)})\n`;
  }
  return entry;
}
