import { formatBytes, getExt, readFile } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo } from "../types/index.js";
import { showNotification } from "./index.js";

// biome-ignore lint/suspicious/noExplicitAny: Global third-party library
declare const CodeMirror: any;

export function getMode(filePath: string): string {
	if (typeof CodeMirror === "undefined") return "text/plain";
	const ext = getExt(filePath).substring(1);
	const info = CodeMirror.findModeByExtension(ext);
	return info ? info.mode || "text/plain" : "text/plain";
}

export function updateViewer(filePath: string, content: string): void {
	let modeName = "N/A";
	if (appState.viewerInstance) {
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		const mode = (appState.viewerInstance as any).getOption("mode");
		modeName = typeof mode === "string" ? mode : mode?.name || "unknown";
	}
	if (elements.viewerInfo) {
		elements.viewerInfo.textContent = `Size: ${formatBytes(content.length)} | Mode: ${modeName}`;
	}
	if (elements.viewerFileTitle) {
		elements.viewerFileTitle.textContent = `VIEWING: ${filePath}`;
	}
}

export async function openFile(file: FileInfo): Promise<void> {
	if (
		appState.isViewerActive &&
		appState.currentViewingFile?.path === file.path
	)
		return;

	const res = await readFile(file.entryHandle);
	if (!res.ok) {
		showNotification(`Error: ${res.error.message}`, 4000);
		return;
	}

	const content = res.value;
	appState.currentViewingFile = file;

	initOrSet(file, content);
	showUI();
	appState.isViewerActive = true;
	setTimeout(() => {
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		(appState.viewerInstance as any)?.refresh();
	}, 10);
}

function initOrSet(file: FileInfo, content: string) {
	const mode = getMode(file.path);
	if (!appState.viewerInstance && elements.viewerContent) {
		appState.viewerInstance = CodeMirror(elements.viewerContent, {
			value: content,
			mode,
			lineNumbers: true,
			theme: "material-darker",
			readOnly: true,
			lineWrapping: true,
		});
	} else if (appState.viewerInstance) {
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		(appState.viewerInstance as any).setValue(content);
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		(appState.viewerInstance as any).setOption("mode", mode);
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		(appState.viewerInstance as any).clearHistory();
	}
	updateViewer(file.path, content);
}

function showUI() {
	if (elements.mainViewTabs) elements.mainViewTabs.style.display = "none";
	if (elements.tabContentArea) elements.tabContentArea.style.display = "none";
	if (elements.fileViewer) elements.fileViewer.style.display = "flex";
}

export function closeViewer(): void {
	if (elements.fileViewer) elements.fileViewer.style.display = "none";
	if (elements.mainViewTabs) elements.mainViewTabs.style.display = "flex";
	if (elements.tabContentArea) elements.tabContentArea.style.display = "flex";
	appState.isViewerActive = false;
	appState.currentViewingFile = null;
}
