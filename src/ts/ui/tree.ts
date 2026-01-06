import { formatBytes, isLikelyText, sniffIsText } from "../filesystem.js";
import { elements, ICONS } from "../state.js";
import type { FileInfo, FolderInfo } from "../types/index.js";
import { showNotification } from "./index.js";
import { openFile } from "./viewer.js";

export function renderTree(
	node: FolderInfo | FileInfo,
	parent: HTMLElement,
): void {
	const li = createNode(node);
	parent.appendChild(li);

	if (node.type === "folder" && node.children.length > 0) {
		const ul = document.createElement("ul");
		node.children
			.slice()
			.sort(sortNodes)
			.forEach((child) => {
				renderTree(child, ul);
			});
		li.appendChild(ul);
	}
}

function sortNodes(a: FolderInfo | FileInfo, b: FolderInfo | FileInfo) {
	if (a.type === "folder" && b.type === "file") return -1;
	if (a.type === "file" && b.type === "folder") return 1;
	return a.name.localeCompare(b.name);
}

function createNode(node: FolderInfo | FileInfo): HTMLElement {
	const li = document.createElement("li");
	li.className = node.type;
	if (node.type === "folder") li.classList.add("collapsed");
	li.dataset.path = node.path;
	li.dataset.selected = "true";

	const itemLine = document.createElement("div");
	itemLine.className = "item-line";

	const itemPrefix = createPrefix(li, node);
	const nameSpan = createName(li, node);
	const statsSpan = createStats(node);

	itemLine.append(itemPrefix, nameSpan, statsSpan);
	li.appendChild(itemLine);
	return li;
}

function createPrefix(li: HTMLElement, node: FolderInfo | FileInfo) {
	const span = document.createElement("span");
	span.className = "item-prefix";

	const selector = document.createElement("input");
	selector.type = "checkbox";
	selector.className = "selector";
	selector.checked = true;
	selector.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		updateSelects(li, target.checked);
		updateParents(li.parentElement?.closest("li.folder") as HTMLElement | null);
	});
	span.appendChild(selector);

	if (node.type === "folder") {
		const toggle = document.createElement("span");
		toggle.className = "folder-toggle";
		toggle.textContent = "▸";
		toggle.addEventListener("click", (e) => {
			e.stopPropagation();
			li.classList.toggle("collapsed");
			toggle.textContent = li.classList.contains("collapsed") ? "▸" : "▾";
		});
		span.appendChild(toggle);
	}

	const iconSpan = document.createElement("span");
	iconSpan.className = "icon";
	iconSpan.innerHTML = node.type === "folder" ? ICONS.folder : ICONS.file;
	span.appendChild(iconSpan);
	return span;
}

function createName(li: HTMLElement, node: FolderInfo | FileInfo) {
	const span = document.createElement("span");
	span.className = "name";
	span.textContent = node.name;
	span.addEventListener("click", async () => {
		if (node.type === "file") {
			await tryOpenFile(node as FileInfo);
		} else {
			(li.querySelector(".folder-toggle") as HTMLElement)?.click();
		}
	});
	return span;
}

async function tryOpenFile(file: FileInfo) {
	if (isLikelyText(file.path) || (await sniffIsText(file.entryHandle))) {
		openFile(file);
	} else {
		showNotification("Not text.", 2500);
	}
}

function createStats(node: FolderInfo | FileInfo) {
	const span = document.createElement("span");
	span.className = "stats";
	span.textContent =
		node.type === "folder"
			? `(${(node as FolderInfo).fileCount} files)`
			: `(${formatBytes((node as FileInfo).size)})`;
	return span;
}

function updateSelects(li: HTMLElement, isSelected: boolean): void {
	li.dataset.selected = isSelected.toString();
	const checkbox = li.querySelector(
		":scope > .item-line > .item-prefix > .selector",
	) as HTMLInputElement | null;
	if (checkbox) {
		checkbox.checked = isSelected;
		checkbox.indeterminate = false;
	}
	li.querySelectorAll(":scope > ul > li").forEach((child) => {
		updateSelects(child as HTMLElement, isSelected);
	});
}

function updateParents(parentLi: HTMLElement | null): void {
	if (!parentLi) return;
	const selectors = Array.from(
		parentLi.querySelectorAll(
			":scope > ul > li > .item-line > .item-prefix > .selector",
		),
	) as HTMLInputElement[];
	const parent = parentLi.querySelector(
		":scope > .item-line > .item-prefix > .selector",
	) as HTMLInputElement | null;

	if (selectors.length > 0 && parent) {
		updateParent(parentLi, parent, selectors);
	}

	const gp = parentLi.parentElement?.closest("li.folder") as HTMLElement | null;
	if (gp) updateParents(gp);
}

function updateParent(
	li: HTMLElement,
	parent: HTMLInputElement,
	childSelectors: HTMLInputElement[],
) {
	const numChecked = childSelectors.filter(
		(s) => s.checked && !s.indeterminate,
	).length;
	const numIndeterminate = childSelectors.filter((s) => s.indeterminate).length;

	if (numChecked === 0 && numIndeterminate === 0) {
		parent.checked = false;
		parent.indeterminate = false;
		li.dataset.selected = "false";
	} else if (numChecked === childSelectors.length) {
		parent.checked = true;
		parent.indeterminate = false;
		li.dataset.selected = "true";
	} else {
		parent.checked = false;
		parent.indeterminate = true;
		li.dataset.selected = "true";
	}
}

export function setAllSelections(isSelected: boolean): void {
	elements.treeContainer?.querySelectorAll("li").forEach((el: Element) => {
		const li = el as HTMLElement;
		const checkbox = li.querySelector(
			":scope > .item-line > .item-prefix > .selector",
		) as HTMLInputElement | null;
		if (checkbox) {
			checkbox.checked = isSelected;
			checkbox.indeterminate = false;
		}
		li.dataset.selected = isSelected.toString();
	});
}

export function toggleAllFolders(collapse: boolean): void {
	elements.treeContainer
		?.querySelectorAll(".tree .folder")
		.forEach((el: Element) => {
			const folderLi = el as HTMLElement;
			folderLi.classList.toggle("collapsed", collapse);
			const toggle = folderLi.querySelector(".folder-toggle");
			if (toggle) toggle.textContent = collapse ? "▸" : "▾";
		});
}
