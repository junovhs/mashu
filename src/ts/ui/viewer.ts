import { readFile } from "../filesystem.js";
import { appState, elements } from "../state.js";
import type { FileInfo } from "../types/index.js";
import { formatBytes, getExt } from "../utils/fs_utils.js";
import { showNotification } from "./index.js";

declare const CodeMirror: {
  (host: HTMLElement, options?: unknown): CodeMirror.Editor;
  findModeByExtension(ext: string): { mode: string; name: string } | undefined;
};

declare namespace CodeMirror {
  interface Editor {
    refresh(): void;
    setValue(content: string): void;
    setOption(name: string, value: unknown): void;
    getOption(name: string): unknown;
    clearHistory(): void;
  }
}

function getMode(filePath: string): string {
  const ext = getExt(filePath).substring(1);
  const info = CodeMirror.findModeByExtension(ext);
  return info ? info.mode || "text/plain" : "text/plain";
}

export function updateViewer(filePath: string, content: string): void {
  let modeName = "N/A";
  const viewer = appState.viewerInstance;
  if (viewer) {
    const mode = viewer.getOption("mode");
    if (typeof mode === "string") {
      modeName = mode;
    } else if (mode && typeof mode === "object" && "name" in mode) {
      modeName = (mode as { name: string }).name;
    } else {
      modeName = "unknown";
    }
  }
  const info = elements.viewerInfo;
  if (info) {
    info.textContent = `Size: ${formatBytes(content.length)} | Mode: ${modeName}`;
  }
  const title = elements.viewerFileTitle;
  if (title) {
    title.textContent = `VIEWING: ${filePath}`;
  }
}

export async function openFile(file: FileInfo): Promise<void> {
  if (
    appState.isViewerActive &&
    appState.currentViewingFile?.path === file.path
  )
    return;

  // Debug: verify the handle exists
  if (!file.entryHandle) {
    showNotification("Error: File handle is missing", 4000);
    console.error("openFile: file.entryHandle is undefined", file);
    return;
  }

  if (typeof file.entryHandle.getFile !== "function") {
    showNotification("Error: Invalid file handle", 4000);
    console.error("openFile: getFile is not a function", file.entryHandle);
    return;
  }

  try {
    const res = await readFile(file.entryHandle);
    if (!res.ok) {
      showNotification(`Error reading file: ${res.error.message}`, 4000);
      console.error("openFile: readFile failed", res.error);
      return;
    }

    const content = res.value;
    appState.currentViewingFile = file;

    initOrSet(file, content);
    showUI();
    appState.isViewerActive = true;
    setTimeout(() => {
      appState.viewerInstance?.refresh();
    }, 10);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showNotification(`Error: ${msg}`, 4000);
    console.error("openFile: unexpected error", err);
  }
}

function initOrSet(file: FileInfo, content: string) {
  const mode = getMode(file.path);
  const container = elements.viewerContent;
  if (!appState.viewerInstance && container) {
    appState.viewerInstance = CodeMirror(container, {
      value: content,
      mode,
      lineNumbers: true,
      theme: "default",
      readOnly: true,
      lineWrapping: true,
    });
  } else if (appState.viewerInstance) {
    appState.viewerInstance.setValue(content);
    appState.viewerInstance.setOption("mode", mode);
    appState.viewerInstance.clearHistory();
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
