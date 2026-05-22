import { appState, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { formatBytes } from "../utils/fs_utils.js";
import { openFile } from "./viewer.js";

interface TreeStateOptions {
  initialCollapsed?: boolean;
  initialSelected?: boolean;
  expandRootOnly?: boolean;
}

type TreeNode = FileInfo | FolderInfo;
type SelectionState = "all" | "none" | "partial";
type FileIconKind =
  | "archive"
  | "binary"
  | "code"
  | "config"
  | "data"
  | "doc"
  | "image"
  | "media"
  | "shell";

const ARCHIVE_EXTENSIONS = new Set([
  ".7z",
  ".bz2",
  ".gz",
  ".jar",
  ".rar",
  ".tar",
  ".tgz",
  ".war",
  ".zip",
]);

const BINARY_EXTENSIONS = new Set([
  ".a",
  ".bin",
  ".class",
  ".dat",
  ".dll",
  ".dylib",
  ".exe",
  ".o",
  ".obj",
  ".so",
  ".wasm",
]);

const CODE_EXTENSIONS = new Set([
  ".asm",
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".cxx",
  ".go",
  ".h",
  ".hh",
  ".hpp",
  ".hxx",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".less",
  ".lua",
  ".m",
  ".mdx",
  ".mjml",
  ".mm",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
]);

const CONFIG_EXTENSIONS = new Set([
  ".cfg",
  ".conf",
  ".editorconfig",
  ".env",
  ".gitignore",
  ".ini",
  ".lock",
  ".plist",
  ".properties",
  ".rc",
  ".toml",
  ".xml",
  ".yaml",
  ".yml",
]);

const DATA_EXTENSIONS = new Set([
  ".csv",
  ".geojson",
  ".graphql",
  ".json",
  ".json5",
  ".jsonl",
  ".ndjson",
  ".parquet",
  ".proto",
  ".prisma",
  ".tsv",
]);

const DOC_EXTENSIONS = new Set([
  ".adoc",
  ".asciidoc",
  ".log",
  ".markdown",
  ".md",
  ".note",
  ".notes",
  ".pdf",
  ".readme",
  ".rst",
  ".rtf",
  ".txt",
]);

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const MEDIA_EXTENSIONS = new Set([
  ".avi",
  ".flac",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
  ".webm",
]);

const SHELL_EXTENSIONS = new Set([
  ".bash",
  ".bat",
  ".cmd",
  ".fish",
  ".ksh",
  ".ps1",
  ".psd1",
  ".psm1",
  ".zsh",
]);

const FILE_ICON_MARKUP: Record<FileIconKind, string> = {
  archive:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10a2 2 0 0 1 2 2v4H5V5a2 2 0 0 1 2-2Zm-2 8h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Zm5-5h4v2h-4Zm0 4h4v6h-4Z"/></svg>`,
  binary:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 7h8v10H8Z"/><path fill="currentColor" d="M10 3h1v3h-1Zm3 0h1v3h-1Zm7 7v1h-3v-1Zm0 3v1h-3v-1ZM10 18h1v3h-1Zm3 0h1v3h-1ZM4 10v1h3v-1ZM4 13v1h3v-1Z"/></svg>`,
  code:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9.4 8.2-4 3.8 4 3.8 1.4-1.4L8.2 12l2.6-2.4Zm5.2 0-1.4 1.4 2.6 2.4-2.6 2.4 1.4 1.4 4-3.8Zm-1-3.2h-1.8l-2.4 14h1.8Z"/></svg>`,
  config:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 6h10v2H5Zm0 10h10v2H5Zm6-5h8v2h-8Z"/><circle cx="17" cy="7" r="2" fill="currentColor"/><circle cx="7" cy="17" r="2" fill="currentColor"/><circle cx="9" cy="12" r="2" fill="currentColor"/></svg>`,
  data:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h12v4H6Zm0 6h5v10H6Zm7 0h5v4h-5Zm0 6h5v4h-5Z"/></svg>`,
  doc:
    ICONS.file,
  image:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 5h14v14H5Zm2 10 3-3 2 2 3-4 2 5Z"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/></svg>`,
  media:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 3v8l6-4Z"/></svg>`,
  shell:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16v14H4Zm3.2 4.2 2.8 2.8-2.8 2.8 1.2 1.2 4-4-4-4Zm6.3 6.1h4v1.5h-4Z"/></svg>`,
};

const SPECIAL_FILE_KINDS = new Map<string, FileIconKind>([
  ["dockerfile", "config"],
  ["makefile", "code"],
  ["package-lock.json", "archive"],
  ["package.json", "config"],
  ["readme", "doc"],
  ["readme.md", "doc"],
  ["tsconfig.json", "config"],
  ["vite.config.ts", "code"],
]);

// ---------------------------------------------------------------------------
// Virtual scroll state
// ---------------------------------------------------------------------------

interface FlatRow {
  node: FileInfo | FolderInfo;
  depth: number;
}

const ROW_HEIGHT = 32;
const OVERSCAN = 8;

let flatRows: FlatRow[] = [];
let vScrollContainer: HTMLElement | null = null;
let vTopSpacer: HTMLDivElement | null = null;
let vRowWindow: HTMLDivElement | null = null;
let vBottomSpacer: HTMLDivElement | null = null;
let vWindowStart = -1;
let vWindowEnd = -1;
let scrollRAF: number | null = null;

function onTreeScroll(): void {
  if (scrollRAF !== null) return;
  scrollRAF = requestAnimationFrame(() => {
    scrollRAF = null;
    if (vScrollContainer) renderVisibleWindow(vScrollContainer.scrollTop);
  });
}

function flattenVisible(
  node: FileInfo | FolderInfo,
  query: string,
  depth: number,
  out: FlatRow[],
): void {
  if (query && !treeMatchesQuery(node, query)) return;
  out.push({ node, depth });
  if (node.type === "folder" && shouldRenderChildren(node, query)) {
    for (const child of node.children) {
      flattenVisible(child, query, depth + 1, out);
    }
  }
}

function renderVisibleWindow(scrollTop: number, forceRebuild = false): void {
  if (!vRowWindow || !vTopSpacer || !vBottomSpacer || !vScrollContainer) return;

  const viewHeight = vScrollContainer.clientHeight || 600;
  const totalRows = flatRows.length;

  const firstVisible = Math.floor(scrollTop / ROW_HEIGHT);
  const newStart = Math.max(0, firstVisible - OVERSCAN);
  const newEnd = Math.min(totalRows, firstVisible + Math.ceil(viewHeight / ROW_HEIGHT) + OVERSCAN);

  vTopSpacer.style.height = `${newStart * ROW_HEIGHT}px`;
  vBottomSpacer.style.height = `${Math.max(0, totalRows - newEnd) * ROW_HEIGHT}px`;

  // Full rebuild when forced, first render, or no overlap with current window.
  if (forceRebuild || vWindowStart === -1 || newEnd <= vWindowStart || newStart >= vWindowEnd) {
    vRowWindow.innerHTML = "";
    for (let i = newStart; i < newEnd; i++) {
      vRowWindow.appendChild(createRowElement(flatRows[i]));
    }
    vWindowStart = newStart;
    vWindowEnd = newEnd;
    return;
  }

  // Skip if window hasn't changed.
  if (newStart === vWindowStart && newEnd === vWindowEnd) return;

  // Incremental: remove rows that scrolled out, append/prepend rows that scrolled in.
  if (newStart > vWindowStart) {
    const count = Math.min(newStart - vWindowStart, vRowWindow.children.length);
    for (let i = 0; i < count; i++) vRowWindow.firstChild?.remove();
  }
  if (newEnd < vWindowEnd) {
    const count = Math.min(vWindowEnd - newEnd, vRowWindow.children.length);
    for (let i = 0; i < count; i++) vRowWindow.lastChild?.remove();
  }
  if (newEnd > vWindowEnd) {
    for (let i = Math.max(vWindowEnd, newStart); i < newEnd; i++) {
      vRowWindow.appendChild(createRowElement(flatRows[i]));
    }
  }
  if (newStart < vWindowStart) {
    const frag = document.createDocumentFragment();
    for (let i = newStart; i < Math.min(vWindowStart, newEnd); i++) {
      frag.appendChild(createRowElement(flatRows[i]));
    }
    vRowWindow.insertBefore(frag, vRowWindow.firstChild);
  }

  vWindowStart = newStart;
  vWindowEnd = newEnd;
}

// ---------------------------------------------------------------------------
// Public tree API
// ---------------------------------------------------------------------------

export function initTreeState(
  root: FolderInfo,
  options: TreeStateOptions = {},
): void {
  appState.treeNodesByPath.clear();
  appState.treeParentPaths.clear();
  appState.subtreeNodeCounts.clear();
  appState.selectedSubtreeCounts.clear();
  appState.selectedPaths.clear();
  appState.expandedFolderPaths.clear();

  buildTreeModel(root, null, options.initialSelected ?? false);

  if (!options.initialCollapsed) {
    expandAllFoldersInState();
  } else if (options.expandRootOnly) {
    appState.expandedFolderPaths.add(root.path);
  }
}

const boundTreeContainers = new WeakSet<HTMLElement>();

export function renderTree(root: FolderInfo, container: HTMLElement): void {
  const query = appState.treeSearchQuery.trim().toLowerCase();

  vScrollContainer = container;
  container.removeEventListener("scroll", onTreeScroll);

  const topSpacer = document.createElement("div");
  const rowWindow = document.createElement("div");
  const bottomSpacer = document.createElement("div");

  vTopSpacer = topSpacer;
  vRowWindow = rowWindow;
  vBottomSpacer = bottomSpacer;

  container.innerHTML = "";
  container.appendChild(topSpacer);
  container.appendChild(rowWindow);
  container.appendChild(bottomSpacer);

  flatRows = [];
  flattenVisible(root, query, 0, flatRows);
  vWindowStart = -1;
  vWindowEnd = -1;
  renderVisibleWindow(container.scrollTop);

  bindTreeInteractions(container);
  container.addEventListener("scroll", onTreeScroll, { passive: true });
}

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

function createRowElement(row: FlatRow): HTMLDivElement {
  const { node, depth } = row;
  const div = document.createElement("div");
  div.style.paddingLeft = `${depth * 14}px`;
  div.dataset.path = node.path;

  if (node.type === "folder") {
    const selectionState = getSelectionState(node.path);
    div.className = "tree-row tree-row--folder";
    div.dataset.selected = String(selectionState !== "none");
    if (!appState.expandedFolderPaths.has(node.path)) {
      div.classList.add("collapsed");
    }
    div.appendChild(createFolderItemLine(node, selectionState));
  } else {
    const ext = getFileExt(node.name);
    div.className = "tree-row tree-row--file";
    div.dataset.ext = ext;
    div.dataset.selected = String(appState.selectedPaths.has(node.path));
    div.appendChild(createFileItemLine(node));
  }

  const selectedPaths = appState.selectedPaths;
  if (selectedPaths.size > 0) {
    const inSelection =
      node.type === "folder"
        ? (appState.selectedSubtreeCounts.get(node.path) || 0) > 0
        : selectedPaths.has(node.path);
    if (!inSelection) {
      div.classList.add("dimmed-uncommitted");
    }
  }

  return div;
}

function createFolderItemLine(
  folder: FolderInfo,
  selectionState: SelectionState,
): HTMLDivElement {
  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = selectionState === "all";
  checkbox.indeterminate = selectionState === "partial";

  const toggle = document.createElement("span");
  toggle.className = "folder-toggle";
  toggle.textContent = appState.expandedFolderPaths.has(folder.path)
    ? "▼"
    : "▶";

  const icon = document.createElement("span");
  icon.className = "icon icon--folder";
  icon.innerHTML = ICONS.folder;

  prefix.appendChild(checkbox);
  prefix.appendChild(toggle);
  prefix.appendChild(icon);

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = folder.name;

  const stats = document.createElement("span");
  stats.className = "stats";
  stats.textContent = `${folder.fileCount} files, ${formatBytes(folder.totalSize)}`;

  itemLine.appendChild(prefix);
  itemLine.appendChild(name);
  itemLine.appendChild(createSizeBar(folder.totalSize));
  itemLine.appendChild(stats);

  return itemLine;
}

function createFileItemLine(file: FileInfo): HTMLDivElement {
  const iconKind = getFileIconKind(file);

  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = appState.selectedPaths.has(file.path);

  const spacer = document.createElement("span");
  spacer.className = "folder-toggle";
  spacer.style.visibility = "hidden";
  spacer.textContent = "▼";

  const icon = document.createElement("span");
  icon.className = `icon icon--file icon--${iconKind}`;
  icon.innerHTML = FILE_ICON_MARKUP[iconKind];

  prefix.appendChild(checkbox);
  prefix.appendChild(spacer);
  prefix.appendChild(icon);

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = file.name;

  const stats = document.createElement("span");
  stats.className = "stats";
  stats.textContent = formatBytes(file.size);

  itemLine.appendChild(prefix);
  itemLine.appendChild(name);
  itemLine.appendChild(createSizeBar(file.size));
  itemLine.appendChild(stats);

  return itemLine;
}

function createSizeBar(size: number): HTMLSpanElement {
  const root = appState.fullScanData?.directoryData;
  const denom = root?.totalSize ?? 0;
  let ratio = 0;
  if (denom > 0 && size > 0) {
    // Square-root scaling keeps tiny files visible while letting big folders fill the bar.
    ratio = Math.sqrt(size / denom);
  }
  ratio = Math.max(0.04, Math.min(1, ratio));
  const bar = document.createElement("span");
  bar.className = "sizebar";
  const fill = document.createElement("i");
  fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  bar.appendChild(fill);
  return bar;
}

// ---------------------------------------------------------------------------
// Interaction binding
// ---------------------------------------------------------------------------

function bindTreeInteractions(container: HTMLElement): void {
  if (boundTreeContainers.has(container)) return;
  boundTreeContainers.add(container);

  container.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("selector")) return;

    const row = target.closest(".tree-row");
    if (!(row instanceof HTMLElement)) return;

    const path = row.dataset.path;
    if (!path) return;

    setSelectionForSubtree(path, target.checked);
  });

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".selector")) return;

    const row = target.closest(".tree-row");
    if (!(row instanceof HTMLElement)) return;

    const path = row.dataset.path;
    if (!path) return;

    if (row.classList.contains("tree-row--folder")) {
      if (event.altKey || event.shiftKey) {
        setExpandedForSubtree(path, !appState.expandedFolderPaths.has(path));
      } else {
        toggleExpanded(path);
      }
      rerenderVisibleTree();
      return;
    }

    if (!target.closest(".name")) return;
    const node = appState.treeNodesByPath.get(path);
    if (node?.type === "file") {
      console.log("[tree] Click on file:", node.path);
      void openFile(node);
    }
  });
}

// ---------------------------------------------------------------------------
// Rerender helpers
// ---------------------------------------------------------------------------

function rerenderVisibleTree(): void {
  const root = appState.fullScanData?.directoryData;
  if (!root || !vScrollContainer || !vRowWindow || !vTopSpacer || !vBottomSpacer) return;

  const query = appState.treeSearchQuery.trim().toLowerCase();
  flatRows = [];
  flattenVisible(root, query, 0, flatRows);
  vWindowStart = -1; // force full rebuild — structure changed
  vWindowEnd = -1;
  renderVisibleWindow(vScrollContainer.scrollTop);
}

function refreshVisibleSelectionState(): void {
  if (!vRowWindow) return;
  const selectedPaths = appState.selectedPaths;
  const hasAnySelection = selectedPaths.size > 0;

  for (const rowEl of vRowWindow.children) {
    if (!(rowEl instanceof HTMLElement)) continue;
    const path = rowEl.dataset.path;
    if (!path) continue;
    const node = appState.treeNodesByPath.get(path);
    if (!node) continue;

    const checkbox = rowEl.querySelector<HTMLInputElement>(".selector");
    let isSelected: boolean;

    if (node.type === "folder") {
      const state = getSelectionState(path);
      isSelected = state !== "none";
      if (checkbox) {
        checkbox.checked = state === "all";
        checkbox.indeterminate = state === "partial";
      }
    } else {
      isSelected = selectedPaths.has(path);
      if (checkbox) {
        checkbox.checked = isSelected;
        checkbox.indeterminate = false;
      }
    }

    rowEl.dataset.selected = String(isSelected);

    if (hasAnySelection) {
      const inSelection = node.type === "folder"
        ? (appState.selectedSubtreeCounts.get(path) ?? 0) > 0
        : selectedPaths.has(path);
      rowEl.classList.toggle("dimmed-uncommitted", !inSelection);
    } else {
      rowEl.classList.remove("dimmed-uncommitted");
    }
  }
}

function notifySelectionChanged(): void {
  window.dispatchEvent(new CustomEvent("mashu:selection-changed"));
}

// ---------------------------------------------------------------------------
// Tree query helpers
// ---------------------------------------------------------------------------

function shouldRenderChildren(folder: FolderInfo, searchQuery: string): boolean {
  if (searchQuery) {
    return folder.children.some((child) => treeMatchesQuery(child, searchQuery));
  }
  return appState.expandedFolderPaths.has(folder.path);
}

function treeMatchesQuery(
  node: FolderInfo | FileInfo,
  searchQuery: string,
): boolean {
  if (!searchQuery) return true;
  const haystack = `${node.name} ${node.path}`.toLowerCase();
  if (haystack.includes(searchQuery)) return true;
  if (node.type === "folder") {
    return node.children.some((child) => treeMatchesQuery(child, searchQuery));
  }
  return false;
}

function nodeDirectlyMatchesQuery(
  node: FolderInfo | FileInfo,
  searchQuery: string,
): boolean {
  if (!searchQuery) return true;
  const haystack = `${node.name} ${node.path}`.toLowerCase();
  return haystack.includes(searchQuery);
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function getFileExt(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx < 1) return "";
  return filename.slice(dotIdx).toLowerCase();
}

function getFileIconKind(file: FileInfo): FileIconKind {
  const lowerName = file.name.toLowerCase();
  const ext = getFileExt(lowerName);

  const specialKind = SPECIAL_FILE_KINDS.get(lowerName);
  if (specialKind) return specialKind;
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archive";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (MEDIA_EXTENSIONS.has(ext)) return "media";
  if (SHELL_EXTENSIONS.has(ext)) return "shell";
  if (DATA_EXTENSIONS.has(ext)) return "data";
  if (CONFIG_EXTENSIONS.has(ext) || lowerName.startsWith(".")) return "config";
  if (BINARY_EXTENSIONS.has(ext)) return "binary";
  if (DOC_EXTENSIONS.has(ext)) return "doc";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  return "doc";
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

export function setSelectionByExtension(ext: string, selected: boolean): void {
  const root = appState.fullScanData?.directoryData;
  if (!root) return;

  appState.treeNodesByPath.forEach((node) => {
    if (node.type === "file" && getFileExt(node.name) === ext) {
      if (selected) appState.selectedPaths.add(node.path);
      else appState.selectedPaths.delete(node.path);
      appState.selectedSubtreeCounts.set(node.path, selected ? 1 : 0);
    }
  });
  appState.treeNodesByPath.forEach((node) => {
    if (node.type === "folder") recomputeAncestorCounts(node.path);
  });
  refreshVisibleSelectionState();
  notifySelectionChanged();

  if (appState.scanWorker && appState.rustIndexReady) {
    postSelectionUpdate();
  }
}

function toggleExpanded(path: string): void {
  if (appState.expandedFolderPaths.has(path)) {
    appState.expandedFolderPaths.delete(path);
  } else {
    appState.expandedFolderPaths.add(path);
  }
}

function setExpandedForSubtree(path: string, expanded: boolean): void {
  const node = appState.treeNodesByPath.get(path);
  if (!node || node.type !== "folder") return;

  const stack: FolderInfo[] = [node];
  while (stack.length > 0) {
    const current = stack.pop() as FolderInfo;
    if (expanded) {
      appState.expandedFolderPaths.add(current.path);
    } else {
      appState.expandedFolderPaths.delete(current.path);
    }
    for (const child of current.children) {
      if (child.type === "folder") {
        stack.push(child);
      }
    }
  }
}

function buildTreeModel(
  node: TreeNode,
  parentPath: string | null,
  initiallySelected: boolean,
): number {
  appState.treeNodesByPath.set(node.path, node);
  appState.treeParentPaths.set(node.path, parentPath);

  if (node.type === "file") {
    if (initiallySelected) {
      appState.selectedPaths.add(node.path);
      appState.selectedSubtreeCounts.set(node.path, 1);
    } else {
      appState.selectedSubtreeCounts.set(node.path, 0);
    }
    appState.subtreeNodeCounts.set(node.path, 1);
    return 1;
  }

  let count = 1;
  let selectedCount = initiallySelected ? 1 : 0;
  if (initiallySelected) {
    appState.selectedPaths.add(node.path);
  }

  for (const child of node.children) {
    count += buildTreeModel(child, node.path, initiallySelected);
    selectedCount += appState.selectedSubtreeCounts.get(child.path) || 0;
  }

  appState.subtreeNodeCounts.set(node.path, count);
  appState.selectedSubtreeCounts.set(node.path, selectedCount);
  return count;
}

function getSelectionState(path: string): SelectionState {
  const node = appState.treeNodesByPath.get(path);
  if (!node) return "none";

  if (node.type === "file") {
    return appState.selectedPaths.has(path) ? "all" : "none";
  }

  const selectedCount = appState.selectedSubtreeCounts.get(path) || 0;
  const totalCount = appState.subtreeNodeCounts.get(path) || 0;
  if (selectedCount === 0) return "none";
  if (selectedCount === totalCount) return "all";
  return "partial";
}

function setSelectionForSubtree(path: string, selected: boolean): void {
  const node = appState.treeNodesByPath.get(path);
  if (!node) return;

  // Optimistic immediate update — no worker round-trip in the visual path.
  applySelectionToNode(node, selected);
  recomputeAncestorCounts(path);
  refreshVisibleSelectionState();
  notifySelectionChanged();

  // Also send to Rust for precise subtree counts; response will re-confirm.
  if (appState.scanWorker && appState.rustIndexReady) {
    postSelectionUpdate();
  }
}

function applySelectionToNode(node: TreeNode, selected: boolean): void {
  if (selected) {
    appState.selectedPaths.add(node.path);
  } else {
    appState.selectedPaths.delete(node.path);
  }

  if (node.type === "file") {
    appState.selectedSubtreeCounts.set(node.path, selected ? 1 : 0);
    return;
  }

  for (const child of node.children) {
    applySelectionToNode(child, selected);
  }

  appState.selectedSubtreeCounts.set(
    node.path,
    selected ? appState.subtreeNodeCounts.get(node.path) || 0 : 0,
  );
}

function applySelectionToFilteredNodes(
  node: TreeNode,
  searchQuery: string,
  selected: boolean,
  coveredByMatchedAncestor = false,
): void {
  if (coveredByMatchedAncestor) return;

  const directlyMatches = nodeDirectlyMatchesQuery(node, searchQuery);
  if (directlyMatches) {
    applySelectionToNode(node, selected);
    return;
  }

  if (node.type === "folder") {
    for (const child of node.children) {
      applySelectionToFilteredNodes(child, searchQuery, selected, false);
    }
  }
}

function recomputeSelectionStateFromRoot(node: TreeNode): number {
  if (node.type === "file") {
    const count = appState.selectedPaths.has(node.path) ? 1 : 0;
    appState.selectedSubtreeCounts.set(node.path, count);
    return count;
  }

  if (node.children.length === 0) {
    const count = appState.selectedPaths.has(node.path) ? 1 : 0;
    appState.selectedSubtreeCounts.set(node.path, count);
    return count;
  }

  let selectedCount = 0;
  for (const child of node.children) {
    selectedCount += recomputeSelectionStateFromRoot(child);
  }

  const totalCount = appState.subtreeNodeCounts.get(node.path) || 0;
  const descendantTotal = Math.max(totalCount - 1, 0);

  if (descendantTotal > 0 && selectedCount === descendantTotal) {
    appState.selectedPaths.add(node.path);
    selectedCount = totalCount;
  } else {
    appState.selectedPaths.delete(node.path);
  }

  appState.selectedSubtreeCounts.set(node.path, selectedCount);
  return selectedCount;
}

function postSelectionUpdate(): void {
  const worker = appState.scanWorker;
  if (!worker) return;
  const filePaths: string[] = [];
  appState.selectedPaths.forEach((p) => {
    if (appState.treeNodesByPath.get(p)?.type === "file") filePaths.push(p);
  });
  worker.postMessage({ type: "compute-selection-state", selectedFilePaths: filePaths });
}

export function applyRustSelectionState(
  selectedSubtreeCounts: Record<string, number>,
  selectedFolderPaths: string[],
): void {
  appState.selectedSubtreeCounts.clear();
  for (const [path, count] of Object.entries(selectedSubtreeCounts)) {
    appState.selectedSubtreeCounts.set(path, count);
  }
  appState.treeNodesByPath.forEach((node, path) => {
    if (node.type === "folder") appState.selectedPaths.delete(path);
  });
  for (const path of selectedFolderPaths) {
    appState.selectedPaths.add(path);
  }
  // Patch tree rows to reflect Rust-corrected counts. Don't re-notify —
  // the optimistic update already fired notifySelectionChanged.
  refreshVisibleSelectionState();
}

function recomputeAncestorCounts(path: string): void {
  let current = path;
  while (current) {
    const parentPath = appState.treeParentPaths.get(current);
    if (!parentPath) break;

    const parentNode = appState.treeNodesByPath.get(parentPath);
    if (parentNode?.type === "folder") {
      let childCount = 0;
      for (const child of parentNode.children) {
        childCount += appState.selectedSubtreeCounts.get(child.path) || 0;
      }

      const totalCount = appState.subtreeNodeCounts.get(parentPath) || 0;
      const descendantTotal = Math.max(totalCount - 1, 0);

      let count = childCount;
      if (descendantTotal > 0 && childCount === descendantTotal) {
        appState.selectedPaths.add(parentPath);
        count = totalCount;
      } else if (childCount === 0) {
        appState.selectedPaths.delete(parentPath);
        count = 0;
      } else {
        appState.selectedPaths.delete(parentPath);
      }
      appState.selectedSubtreeCounts.set(parentPath, count);
    }

    current = parentPath;
  }
}

function expandAllFoldersInState(): void {
  appState.treeNodesByPath.forEach((node) => {
    if (node.type === "folder") {
      appState.expandedFolderPaths.add(node.path);
    }
  });
}

export function setAllSelections(selected: boolean): void {
  const root = appState.fullScanData?.directoryData;
  if (!root) return;
  const searchQuery = appState.treeSearchQuery.trim().toLowerCase();

  if (searchQuery) {
    applySelectionToFilteredNodes(root, searchQuery, selected);
    recomputeSelectionStateFromRoot(root);
  } else if (selected) {
    appState.selectedPaths.clear();
    appState.selectedSubtreeCounts.clear();
    applySelectionToNode(root, true);
  } else {
    appState.selectedPaths.clear();
    appState.selectedSubtreeCounts.clear();
    appState.treeNodesByPath.forEach((node) => {
      appState.selectedSubtreeCounts.set(node.path, 0);
    });
  }

  refreshVisibleSelectionState();
  notifySelectionChanged();

  if (appState.scanWorker && appState.rustIndexReady) {
    postSelectionUpdate();
  }
}

export function toggleAllFolders(collapse: boolean): void {
  appState.expandedFolderPaths.clear();
  if (!collapse) {
    expandAllFoldersInState();
  }
  rerenderVisibleTree();
}
