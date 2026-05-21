import { appState, elements, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { formatBytes } from "../utils/fs_utils.js";
import { setPretextText } from "./pretext.js";
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

const boundTreeContainers = new WeakSet<HTMLElement>();

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

export function renderTree(
  node: FolderInfo | FileInfo,
  container: HTMLElement,
  isRoot = true,
): void {
  if (isRoot) {
    bindTreeInteractions(container);
  }

  const ul = document.createElement("ul");
  if (isRoot) {
    ul.style.paddingLeft = "0";
  }

  if (node.type === "folder") {
    const li = createFolderLi(node);
    ul.appendChild(li);

    if (appState.expandedFolderPaths.has(node.path)) {
      const childUl = document.createElement("ul");
      for (const child of node.children) {
        renderTreeNode(child, childUl);
      }
      li.appendChild(childUl);
    }
  } else {
    ul.appendChild(createFileLi(node));
  }

  container.appendChild(ul);

  if (isRoot) {
    applyActiveSelectionFilterToVisibleTree();
  }
}

function renderTreeNode(
  node: FolderInfo | FileInfo,
  parentUl: HTMLElement,
): void {
  if (node.type === "folder") {
    const li = createFolderLi(node);
    parentUl.appendChild(li);

    if (appState.expandedFolderPaths.has(node.path)) {
      const childUl = document.createElement("ul");
      for (const child of node.children) {
        renderTreeNode(child, childUl);
      }
      li.appendChild(childUl);
    }
  } else {
    parentUl.appendChild(createFileLi(node));
  }
}

function createFolderLi(folder: FolderInfo): HTMLLIElement {
  const selectionState = getSelectionState(folder.path);
  const li = document.createElement("li");
  li.className = "folder";
  li.dataset.path = folder.path;
  li.dataset.selected = String(selectionState !== "none");
  li.classList.toggle(
    "collapsed",
    !appState.expandedFolderPaths.has(folder.path),
  );

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
    ? "\u25bc"
    : "\u25b6";

  const icon = document.createElement("span");
  icon.className = "icon icon--folder";
  icon.innerHTML = ICONS.folder;

  prefix.appendChild(checkbox);
  prefix.appendChild(toggle);
  prefix.appendChild(icon);

  const name = document.createElement("span");
  name.className = "name pretext-flow";
  name.dataset.pretext = "";
  setPretextText(name, folder.name);

  const stats = document.createElement("span");
  stats.className = "stats pretext-flow";
  stats.dataset.pretext = "";
  setPretextText(stats, `${folder.fileCount} files, ${formatBytes(folder.totalSize)}`);

  itemLine.appendChild(prefix);
  itemLine.appendChild(name);
  itemLine.appendChild(createSizeBar(folder.totalSize));
  itemLine.appendChild(stats);

  li.appendChild(itemLine);
  return li;
}

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

function createFileLi(file: FileInfo): HTMLLIElement {
  const ext = getFileExt(file.name);
  const iconKind = getFileIconKind(file);
  const li = document.createElement("li");
  li.className = "file";
  li.dataset.path = file.path;
  li.dataset.ext = ext;
  li.dataset.selected = String(appState.selectedPaths.has(file.path));

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
  spacer.textContent = "\u25bc";

  prefix.appendChild(checkbox);
  prefix.appendChild(spacer);

  const icon = document.createElement("span");
  icon.className = `icon icon--file icon--${iconKind}`;
  icon.innerHTML = FILE_ICON_MARKUP[iconKind];
  prefix.appendChild(icon);

  const name = document.createElement("span");
  name.className = "name pretext-flow";
  name.dataset.pretext = "";
  setPretextText(name, file.name);

  const stats = document.createElement("span");
  stats.className = "stats pretext-flow";
  stats.dataset.pretext = "";
  setPretextText(stats, formatBytes(file.size));

  itemLine.appendChild(prefix);
  itemLine.appendChild(name);
  itemLine.appendChild(createSizeBar(file.size));
  itemLine.appendChild(stats);

  li.appendChild(itemLine);
  return li;
}

function createSizeBar(size: number): HTMLSpanElement {
  const root = appState.fullScanData?.directoryData;
  const denom = root?.totalSize ?? 0;
  // Square-root scaling keeps tiny files visible while letting big folders fill the bar.
  let ratio = 0;
  if (denom > 0 && size > 0) {
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

export function setSelectionByExtension(ext: string, selected: boolean): void {
  const root = appState.fullScanData?.directoryData;
  if (!root) return;

  appState.treeNodesByPath.forEach((node) => {
    if (node.type === "file" && getFileExt(node.name) === ext) {
      applySelectionToNode(node, selected);
    }
  });

  appState.treeNodesByPath.forEach((node) => {
    if (node.type === "folder") {
      recomputeAncestorCounts(node.path);
    }
  });

  refreshVisibleSelectionState();
  notifySelectionChanged();
}

function bindTreeInteractions(container: HTMLElement): void {
  if (boundTreeContainers.has(container)) return;

  container.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("selector")) return;

    const li = target.closest("li");
    if (!(li instanceof HTMLLIElement)) return;

    const path = li.dataset.path;
    if (!path) return;

    setSelectionForSubtree(path, target.checked);
    refreshVisibleSelectionState();
    notifySelectionChanged();
  });

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".selector")) return;

    const li = target.closest("li");
    if (!(li instanceof HTMLLIElement)) return;

    const path = li.dataset.path;
    if (!path) return;

    if (li.classList.contains("folder")) {
      if (event.altKey) {
        setExpandedForSubtree(path, !appState.expandedFolderPaths.has(path));
      } else {
        toggleExpanded(path);
      }
      rerenderVisibleTree();
      return;
    }

    const node = appState.treeNodesByPath.get(path);
    if (node?.type === "file") {
      console.log("[tree] Click on file:", node.path);
      void openFile(node);
    }
  });

  boundTreeContainers.add(container);
}

function rerenderVisibleTree(): void {
  const root = appState.fullScanData?.directoryData;
  const container = elements.treeContainer as HTMLElement | undefined;
  if (!root || !container) return;

  container.innerHTML = "";
  renderTree(root, container);
}

function refreshVisibleSelectionState(): void {
  const container = elements.treeContainer as HTMLElement | undefined;
  if (!container) return;

  container.querySelectorAll("li").forEach((el: Element) => {
    const li = el as HTMLLIElement;
    const path = li.dataset.path;
    if (!path) return;

    const selectionState = getSelectionState(path);
    li.dataset.selected = String(selectionState !== "none");

    const itemLine = li.firstElementChild;
    const checkbox =
      itemLine instanceof HTMLElement
        ? itemLine.querySelector(".selector")
        : null;

    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = selectionState === "all";
      checkbox.indeterminate = selectionState === "partial";
    }
  });

  applyActiveSelectionFilterToVisibleTree();
}

function notifySelectionChanged(): void {
  window.dispatchEvent(new CustomEvent("mashu:selection-changed"));
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

  applySelectionToNode(node, selected);
  recomputeAncestorCounts(path);
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

function applyActiveSelectionFilterToVisibleTree(): void {
  const container = elements.treeContainer as HTMLElement | undefined;
  if (!container) return;

  const selectedPaths = appState.selectedPaths;
  if (selectedPaths.size === 0) {
    container.querySelectorAll("li").forEach((el: Element) => {
      (el as HTMLElement).classList.remove("dimmed-uncommitted");
    });
    return;
  }

  container.querySelectorAll("li").forEach((el: Element) => {
    const li = el as HTMLElement;
    const path = li.dataset.path || "";
    const node = appState.treeNodesByPath.get(path);
    const isInActiveSelection =
      node?.type === "folder"
        ? (appState.selectedSubtreeCounts.get(path) || 0) > 0
        : selectedPaths.has(path);
    li.classList.remove("dimmed-uncommitted");
    if (!isInActiveSelection) {
      li.classList.add("dimmed-uncommitted");
    }
  });
}

export function setAllSelections(selected: boolean): void {
  const root = appState.fullScanData?.directoryData;
  if (!root) return;

  appState.selectedPaths.clear();
  appState.selectedSubtreeCounts.clear();

  if (selected) {
    applySelectionToNode(root, true);
  } else {
    appState.treeNodesByPath.forEach((node) => {
      appState.selectedSubtreeCounts.set(node.path, 0);
    });
  }

  refreshVisibleSelectionState();
  notifySelectionChanged();
}

export function toggleAllFolders(collapse: boolean): void {
  appState.expandedFolderPaths.clear();
  if (!collapse) {
    expandAllFoldersInState();
  }
  rerenderVisibleTree();
}