import { elements, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { formatBytes } from "../utils/fs_utils.js";
import { openFile } from "./viewer.js";

export function renderTree(
  node: FolderInfo | FileInfo,
  container: HTMLElement,
  isRoot = true,
): void {
  const ul = document.createElement("ul");
  if (isRoot) {
    ul.style.paddingLeft = "0";
  }

  if (node.type === "folder") {
    const li = createFolderLi(node);
    ul.appendChild(li);

    const childUl = document.createElement("ul");
    for (const child of node.children) {
      renderTreeNode(child, childUl);
    }
    li.appendChild(childUl);
  } else {
    const li = createFileLi(node);
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

function renderTreeNode(
  node: FolderInfo | FileInfo,
  parentUl: HTMLElement,
): void {
  if (node.type === "folder") {
    const li = createFolderLi(node);
    parentUl.appendChild(li);

    const childUl = document.createElement("ul");
    for (const child of node.children) {
      renderTreeNode(child, childUl);
    }
    li.appendChild(childUl);
  } else {
    const li = createFileLi(node);
    parentUl.appendChild(li);
  }
}

function createFolderLi(folder: FolderInfo): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "folder";
  li.dataset.path = folder.path;
  li.dataset.selected = "true";

  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = true;
  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    toggleSelection(li, checkbox.checked);
  });

  const toggle = document.createElement("span");
  toggle.className = "folder-toggle";
  toggle.textContent = "▼";
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFolder(li, toggle);
  });

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

  itemLine.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("selector")) return;
    if ((e.target as HTMLElement).classList.contains("folder-toggle")) return;
    toggleFolder(li, toggle);
  });

  li.appendChild(itemLine);
  return li;
}

function createFileLi(file: FileInfo): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "file";
  li.dataset.path = file.path;
  li.dataset.selected = "true";

  const itemLine = document.createElement("div");
  itemLine.className = "item-line";

  const prefix = document.createElement("span");
  prefix.className = "item-prefix";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "selector";
  checkbox.checked = true;
  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    toggleSelection(li, checkbox.checked);
  });

  const spacer = document.createElement("span");
  spacer.className = "folder-toggle";
  spacer.style.visibility = "hidden";
  spacer.textContent = "▼";

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

  // Single-click to open file viewer
  itemLine.addEventListener("click", (e) => {
    // Don't open if clicking the checkbox
    if ((e.target as HTMLElement).classList.contains("selector")) return;
    console.log("[tree] Click on file:", file.path);
    openFile(file);
  });

  li.appendChild(itemLine);
  return li;
}

function toggleFolder(li: HTMLLIElement, toggle: HTMLSpanElement): void {
  li.classList.toggle("collapsed");
  toggle.textContent = li.classList.contains("collapsed") ? "▶" : "▼";
}

function toggleSelection(li: HTMLLIElement, selected: boolean): void {
  li.dataset.selected = String(selected);

  // If it's a folder, toggle all children too
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

  // Update parent folder state
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
      parentLi.dataset.selected = "true"; // Partial selection counts as selected
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
      if (toggle) toggle.textContent = "▶";
    } else {
      folder.classList.remove("collapsed");
      if (toggle) toggle.textContent = "▼";
    }
  });
}
