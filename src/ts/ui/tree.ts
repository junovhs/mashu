import { elements, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { formatBytes } from "../utils/fs_utils.js";
import { openFile } from "./viewer.js";

interface RenderTreeOptions {
  initialCollapsed?: boolean;
  initialSelected?: boolean;
}

const fileLookup = new Map<string, FileInfo>();
const boundTreeContainers = new WeakSet<HTMLElement>();

export function renderTree(
  node: FolderInfo | FileInfo,
  container: HTMLElement,
  isRoot = true,
  options: RenderTreeOptions = {},
): void {
  if (isRoot) {
    fileLookup.clear();
    bindTreeInteractions(container);
  }

  const ul = document.createElement("ul");
  if (isRoot) {
    ul.style.paddingLeft = "0";
  }

  if (node.type === "folder") {
    const li = createFolderLi(node, options);
    ul.appendChild(li);

    const childUl = document.createElement("ul");
    for (const child of node.children) {
      renderTreeNode(child, childUl, options);
    }
    li.appendChild(childUl);
  } else {
    const li = createFileLi(node, options);
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

function renderTreeNode(
  node: FolderInfo | FileInfo,
  parentUl: HTMLElement,
  options: RenderTreeOptions,
): void {
  if (node.type === "folder") {
    const li = createFolderLi(node, options);
    parentUl.appendChild(li);

    const childUl = document.createElement("ul");
    for (const child of node.children) {
      renderTreeNode(child, childUl, options);
    }
    li.appendChild(childUl);
  } else {
    const li = createFileLi(node, options);
    parentUl.appendChild(li);
  }
}

function createFolderLi(
  folder: FolderInfo,
  options: RenderTreeOptions,
): HTMLLIElement {
  const isSelected = options.initialSelected ?? true;
  const isCollapsed = options.initialCollapsed ?? false;
  const li = document.createElement("li");
  li.className = "folder";
  li.dataset.path = folder.path;
  li.dataset.selected = String(isSelected);
  li.classList.toggle("collapsed", isCollapsed);

  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = isSelected;

  const toggle = document.createElement("span");
  toggle.className = "folder-toggle";
  toggle.textContent = isCollapsed ? "\u25b6" : "\u25bc";

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

function createFileLi(
  file: FileInfo,
  options: RenderTreeOptions,
): HTMLLIElement {
  const isSelected = options.initialSelected ?? true;
  const li = document.createElement("li");
  li.className = "file";
  li.dataset.path = file.path;
  li.dataset.selected = String(isSelected);
  fileLookup.set(file.path, file);

  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = isSelected;

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
    if (!li) return;
    toggleSelection(li as HTMLLIElement, target.checked);
  });

  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest(".selector")) return;

    const toggleEl = target.closest(".folder-toggle");
    const toggleLi = toggleEl?.closest("li.folder");
    if (toggleEl instanceof HTMLSpanElement && toggleLi instanceof HTMLLIElement) {
      toggleFolder(toggleLi, toggleEl);
      return;
    }

    const itemLine = target.closest(".item-line");
    if (!(itemLine instanceof HTMLElement)) return;

    const li = itemLine.closest("li");
    if (!(li instanceof HTMLLIElement)) return;

    if (li.classList.contains("folder")) {
      const toggle = li.querySelector(
        ":scope > .item-line .folder-toggle",
      ) as HTMLSpanElement | null;
      if (toggle) toggleFolder(li, toggle);
      return;
    }

    const path = li.dataset.path;
    if (!path) return;

    const file = fileLookup.get(path);
    if (!file) return;

    console.log("[tree] Click on file:", file.path);
    openFile(file);
  });

  boundTreeContainers.add(container);
}

function toggleFolder(li: HTMLLIElement, toggle: HTMLSpanElement): void {
  li.classList.toggle("collapsed");
  toggle.textContent = li.classList.contains("collapsed")
    ? "\u25b6"
    : "\u25bc";
}

function toggleSelection(li: HTMLLIElement, selected: boolean): void {
  li.dataset.selected = String(selected);

  if (li.classList.contains("folder")) {
    const childCheckboxes = li.querySelectorAll(
      "ul .selector",
    ) as NodeListOf<HTMLInputElement>;
    childCheckboxes.forEach((cb) => {
      cb.checked = selected;
      const childLi = cb.closest("li");
      if (childLi) {
        (childLi as HTMLElement).dataset.selected = String(selected);
      }
    });
  }

  updateParentState(li);
}

function updateParentState(li: HTMLElement): void {
  const parentUl = li.parentElement;
  if (!parentUl || parentUl.tagName !== "UL") return;

  const parentLi = parentUl.parentElement;
  if (!parentLi || parentLi.tagName !== "LI") return;
  if (!parentLi.classList.contains("folder")) return;

  const siblings = parentUl.querySelectorAll(
    ":scope > li",
  ) as NodeListOf<HTMLLIElement>;
  const allSelected = Array.from(siblings).every(
    (s) => s.dataset.selected === "true",
  );
  const noneSelected = Array.from(siblings).every(
    (s) => s.dataset.selected === "false",
  );

  const parentCheckbox = parentLi.querySelector(
    ":scope > .item-line .selector",
  ) as HTMLInputElement | null;
  if (parentCheckbox) {
    if (allSelected) {
      parentCheckbox.checked = true;
      parentCheckbox.indeterminate = false;
      parentLi.dataset.selected = "true";
    } else if (noneSelected) {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = false;
      parentLi.dataset.selected = "false";
    } else {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = true;
      parentLi.dataset.selected = "true";
    }
  }

  updateParentState(parentLi);
}

export function setAllSelections(selected: boolean): void {
  const container = elements.treeContainer;
  if (!container) return;

  const checkboxes = container.querySelectorAll(
    ".selector",
  ) as NodeListOf<HTMLInputElement>;
  checkboxes.forEach((cb) => {
    cb.checked = selected;
    cb.indeterminate = false;
    const li = cb.closest("li");
    if (li) {
      (li as HTMLElement).dataset.selected = String(selected);
    }
  });
}

export function toggleAllFolders(collapse: boolean): void {
  const container = elements.treeContainer;
  if (!container) return;

  const folders = container.querySelectorAll(
    "li.folder",
  ) as NodeListOf<HTMLLIElement>;
  folders.forEach((folder) => {
    const toggle = folder.querySelector(".folder-toggle") as HTMLSpanElement;
    if (collapse) {
      folder.classList.add("collapsed");
      if (toggle) toggle.textContent = "\u25b6";
    } else {
      folder.classList.remove("collapsed");
      if (toggle) toggle.textContent = "\u25bc";
    }
  });
}
