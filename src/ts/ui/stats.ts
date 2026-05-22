import { formatBytes } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo, FolderInfo, ScanData } from "../types/index.js";
import { setSelectionByExtension } from "./tree.js";

const REPORT_YIELD_EVERY = 400;
const TREE_BRANCH = {
  elbow: "└──  ",
  tee: "├──  ",
  pipe: "│   ",
};

// File-kind colour swatches — paired with the same kinds used by the tree icons.
type Kind =
  | "archive" | "binary" | "code" | "config" | "data"
  | "doc"     | "image"  | "media"| "shell"  | "other";

const KIND_COLOR: Record<Kind, string> = {
  archive: "oklch(0.78 0.07 75)",
  binary:  "oklch(0.76 0.06 245)",
  code:    "oklch(0.74 0.09 240)",
  config:  "oklch(0.76 0.04 290)",
  data:    "oklch(0.75 0.08 165)",
  doc:     "oklch(0.76 0.02 80)",
  image:   "oklch(0.79 0.10 12)",
  media:   "oklch(0.75 0.08 300)",
  shell:   "oklch(0.75 0.08 145)",
  other:   "oklch(0.73 0.01 80)",
};

const CODE_EXT  = new Set([".asm",".c",".cc",".cpp",".cs",".css",".go",".h",".hpp",".java",".js",".jsx",".kt",".less",".lua",".m",".mdx",".mjs",".php",".py",".rb",".rs",".sass",".scss",".sh",".sql",".swift",".ts",".tsx",".vue"]);
const DATA_EXT  = new Set([".csv",".geojson",".graphql",".json",".json5",".jsonl",".ndjson",".parquet",".proto",".prisma",".tsv"]);
const DOC_EXT   = new Set([".adoc",".asciidoc",".log",".markdown",".md",".note",".notes",".pdf",".rst",".rtf",".txt"]);
const IMAGE_EXT = new Set([".avif",".bmp",".gif",".ico",".jpeg",".jpg",".png",".svg",".webp"]);
const MEDIA_EXT = new Set([".avi",".flac",".m4a",".mkv",".mov",".mp3",".mp4",".ogg",".wav",".webm"]);
const SHELL_EXT = new Set([".bash",".bat",".cmd",".fish",".ksh",".ps1",".psd1",".psm1",".zsh"]);
const CONFIG_EXT= new Set([".cfg",".conf",".editorconfig",".env",".gitignore",".ini",".lock",".plist",".properties",".rc",".toml",".xml",".yaml",".yml"]);
const ARCHIVE_EXT= new Set([".7z",".bz2",".gz",".jar",".rar",".tar",".tgz",".war",".zip"]);
const BINARY_EXT = new Set([".a",".bin",".class",".dat",".dll",".dylib",".exe",".o",".obj",".so",".wasm"]);

function extToKind(ext: string): Kind {
  if (!ext) return "other";
  const e = ext.toLowerCase();
  if (ARCHIVE_EXT.has(e)) return "archive";
  if (IMAGE_EXT.has(e))   return "image";
  if (MEDIA_EXT.has(e))   return "media";
  if (SHELL_EXT.has(e))   return "shell";
  if (DATA_EXT.has(e))    return "data";
  if (CONFIG_EXT.has(e))  return "config";
  if (BINARY_EXT.has(e))  return "binary";
  if (DOC_EXT.has(e))     return "doc";
  if (CODE_EXT.has(e))    return "code";
  return "other";
}

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

let cachedStatsKey: string | null = null;

export function resetStatsCache(): void {
  cachedStatsKey = null;
}

export function displayGlobalStats(data: ScanData): void {
  const { directoryData, allFilesList, allFoldersList } = data;
  if (!directoryData) return;

  const isSelection = appState.selectedPaths.size > 0;
  const statsKey = [
    isSelection ? "sel" : "full",
    allFilesList.length,
    allFoldersList.length,
    directoryData.totalSize,
    directoryData.name,
  ].join("|");

  const scopePill = document.getElementById("statScopePill");
  if (scopePill) scopePill.style.display = isSelection ? "inline-flex" : "none";

  if (elements.selectionSummary) {
    if (isSelection) {
      elements.selectionSummary.textContent =
        `Focused view active: ${allFilesList.length} files · ${formatBytes(directoryData.totalSize)}`;
      elements.selectionSummary.style.display = "block";
    } else {
      elements.selectionSummary.style.display = "none";
    }
  }

  if (statsKey === cachedStatsKey) return;
  cachedStatsKey = statsKey;

  if (elements.globalStats) {
    elements.globalStats.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Files</span>
        <span class="stat-value" id="statFiles">${formatCount(allFilesList.length)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Folders</span>
        <span class="stat-value">${formatCount(Math.max(0, allFoldersList.length - 1))}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Size</span>
        <span class="stat-value" id="statSize">${formatBytes(directoryData.totalSize)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Root</span>
        <span class="stat-value stat-value--name">${escapeHtml(directoryData.name)}</span>
      </div>
    `;
  }

  const filterSource =
    appState.fullScanData?.directoryData?.fileTypes || directoryData.fileTypes;
  const sortedTypes = Object.entries(filterSource).sort(
    ([, a], [, b]) => b.size - a.size,
  );

  renderCompositionBar(sortedTypes, directoryData.totalSize);

  if (elements.fileTypeTableBody) {
    elements.fileTypeTableBody.innerHTML = sortedTypes
      .map(([ext, td]) => {
        const kind = extToKind(ext);
        return `<tr data-ext="${ext}">
          <td>
            <span class="type-row-swatch" style="background:${KIND_COLOR[kind]}"></span>
            ${ext || "[none]"}
          </td>
          <td>${td.count}</td>
          <td>${formatBytes(td.size)}</td>
        </tr>`;
      })
      .join("");
  }

  renderExtFilterPills(sortedTypes);
  updateAncillaryUI(allFilesList.length, directoryData.totalSize, isSelection);

  const reportTitle = document.getElementById("reportTitle");
  if (reportTitle) reportTitle.textContent = directoryData.name;

  const reportDescription = document.getElementById("reportDescription");
  if (reportDescription) {
    reportDescription.textContent = "Plain-text map of everything in scope. Ready to copy or save.";
  }
}

export function refreshSelectionStats(): void {
  const fullData = appState.fullScanData;
  if (!fullData?.directoryData) return;

  const isSelection = appState.selectedPaths.size > 0;

  let fileCount: number;
  let totalSize: number;

  if (isSelection) {
    fileCount = 0;
    totalSize = 0;
    for (const path of appState.selectedPaths) {
      const node = appState.treeNodesByPath.get(path);
      if (node?.type === "file") {
        fileCount++;
        totalSize += node.size;
      }
    }
  } else {
    fileCount = fullData.allFilesList.length;
    totalSize = fullData.directoryData.totalSize;
  }

  const scopePill = document.getElementById("statScopePill");
  if (scopePill) scopePill.style.display = isSelection ? "inline-flex" : "none";

  if (elements.selectionSummary) {
    if (isSelection) {
      elements.selectionSummary.textContent =
        `Focused view active: ${fileCount} files · ${formatBytes(totalSize)}`;
      elements.selectionSummary.style.display = "block";
    } else {
      elements.selectionSummary.style.display = "none";
    }
  }

  const statFiles = document.getElementById("statFiles");
  if (statFiles) statFiles.textContent = formatCount(fileCount);
  const statSize = document.getElementById("statSize");
  if (statSize) statSize.textContent = formatBytes(totalSize);

  updateAncillaryUI(fileCount, totalSize, isSelection);
}

function renderCompositionBar(
  sortedTypes: [string, { count: number; size: number }][],
  totalSize: number,
): void {
  const bar = document.getElementById("compositionBar");
  const legend = document.getElementById("compositionLegend");
  if (!bar || !legend || totalSize <= 0) return;

  // Group small (< 1% each) into "other"
  const top: { ext: string; kind: Kind; count: number; size: number }[] = [];
  let otherSize = 0;
  let otherCount = 0;

  for (const [ext, td] of sortedTypes) {
    const pct = td.size / totalSize;
    if (top.length < 7 && pct >= 0.01) {
      top.push({ ext, kind: extToKind(ext), count: td.count, size: td.size });
    } else {
      otherSize += td.size;
      otherCount += td.count;
    }
  }

  const segs = [...top];
  if (otherSize > 0) {
    segs.push({ ext: "other", kind: "other", count: otherCount, size: otherSize });
  }

  bar.innerHTML = segs
    .map((s) => {
      const w = (s.size / totalSize) * 100;
      return `<span style="width:${w.toFixed(2)}%; background:${KIND_COLOR[s.kind]}" title="${s.ext} — ${w.toFixed(1)}%"></span>`;
    })
    .join("");

  legend.innerHTML = segs
    .slice(0, 5)
    .map((s) => {
      const pct = (s.size / totalSize) * 100;
      return `<span class="legend-item">
        <span class="legend-swatch" style="background:${KIND_COLOR[s.kind]}"></span>
        <b>${s.ext || "[none]"}</b>
        <span class="legend-pct">${pct.toFixed(0)}%</span>
      </span>`;
    })
    .join("");
}

function updateAncillaryUI(
  fileCount: number,
  size: number,
  isSelection: boolean,
): void {
  const sideSelected = document.getElementById("sideSelected");
  if (sideSelected) {
    if (isSelection) {
      sideSelected.innerHTML = `<b>${appState.selectedPaths.size}</b> selected`;
    } else {
      sideSelected.textContent = "click ◯ to focus";
    }
  }

  const barInfo = document.getElementById("barInfo");
  if (barInfo) {
    if (isSelection) {
      barInfo.innerHTML = `
        <span><b>${fileCount}</b> files · <b>${formatBytes(size)}</b></span>
        <span class="scope-pill">SELECTION MODE</span>
      `;
    } else {
      barInfo.innerHTML = `
        <span>Working set: <b>full project</b> — <b>${fileCount}</b> files · <b>${formatBytes(size)}</b></span>
      `;
    }
  }

  // Top-bar scope path + meta
  const scopePath = document.getElementById("scopePath");
  const scopeMeta = document.getElementById("scopeMeta");
  const root = appState.fullScanData?.directoryData;
  if (scopePath && root) {
    scopePath.innerHTML = `
      <span class="crumb">~</span>
      <span class="sep">/</span>
      <span class="crumb tip">${escapeHtml(root.name)}</span>
    `;
  }
  if (scopeMeta && root) {
    scopeMeta.innerHTML = `
      <span><span class="pulse"></span>local</span>
      <span><b>${root.fileCount}</b> files · <b>${formatBytes(root.totalSize)}</b></span>
    `;
  }
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
}

function renderExtFilterPills(
  sortedTypes: [string, { count: number; size: number }][],
): void {
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
    .map(([ext, d]) => {
      return `
        <button class="ext-filter-pill" data-ext="${ext}" data-active="${isExtensionFullySelected(ext)}" title="Toggle selection for every ${ext || "[no extension]"} file in the tree">
          <span class="pill-label pretext-flow" data-pretext>${ext || "[none]"}</span>
          <span class="pill-count pretext-flow" data-pretext>${d.count}</span>
        </button>
      `;
    })
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
