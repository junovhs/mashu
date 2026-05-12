import { appState, elements, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { formatBytes } from "../utils/fs_utils.js";
import { openFile } from "./viewer.js";

interface TreeStateOptions {
  initialCollapsed?: boolean;
  initialSelected?: boolean;
}

type TreeNode = FileInfo | FolderInfo;
type SelectionState = "all" | "none" | "partial";

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
    applyCommittedFilterToVisibleTree();
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
  li.classList.toggle("collapsed", !appState.expandedFolderPaths.has(folder.path));

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
  icon.className = "icon";
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
  itemLine.appendChild(stats);

  li.appendChild(itemLine);
  return li;
}

function createFileLi(file: FileInfo): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "file";
  li.dataset.path = file.path;
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

  const icon = document.createElement("span");
  icon.className = "icon";
  icon.innerHTML = ICONS.file;

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
  itemLine.appendChild(stats);

  li.appendChild(itemLine);
  return li;
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
    rerenderVisibleTree();
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
      toggleExpanded(path);
      rerenderVisibleTree();
      return;
    }

    const node = appState.treeNodesByPath.get(path);
    if (node?.type === "file") {
      console.log("[tree] Click on file:", node.path);
      openFile(node);
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

function toggleExpanded(path: string): void {
  if (appState.expandedFolderPaths.has(path)) {
    appState.expandedFolderPaths.delete(path);
  } else {
    appState.expandedFolderPaths.add(path);
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

function applyCommittedFilterToVisibleTree(): void {
  const container = elements.treeContainer as HTMLElement | undefined;
  if (!container) return;

  const committedPaths = new Set<string>();
  if (
    appState.selectionCommitted &&
    appState.committedScanData?.directoryData
  ) {
    const stack: TreeNode[] = [appState.committedScanData.directoryData];
    while (stack.length > 0) {
      const node = stack.pop() as TreeNode;
      committedPaths.add(node.path);
      if (node.type === "folder") {
        for (const child of node.children) {
          stack.push(child);
        }
      }
    }
  }

  container.querySelectorAll("li").forEach((el: Element) => {
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

  rerenderVisibleTree();
}

export function toggleAllFolders(collapse: boolean): void {
  appState.expandedFolderPaths.clear();
  if (!collapse) {
    expandAllFoldersInState();
  }
  rerenderVisibleTree();
}
