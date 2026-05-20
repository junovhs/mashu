import { appState, elements } from "../state.js";
import type { FileInfo } from "../types/index.js";
import { formatBytes, getExt } from "../utils/fs_utils.js";
import { showNotification } from "./index.js";
import { setPretextText } from "./pretext.js";

type ModeSpec = {
  label: string;
  mode: string;
  option: string;
};

const MODE_CDN_BASE =
  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.15/mode/%N/%N.min.js";

function getFallbackModeSpec(): ModeSpec {
  return {
    label: "Plain Text",
    mode: "null",
    option: "text/plain",
  };
}

function resolveModeSpec(fileName: string, mimeType?: string): ModeSpec {
  const byFileName = CodeMirror.findModeByFileName(fileName);
  if (byFileName) {
    return {
      label: byFileName.name,
      mode: byFileName.mode,
      option: byFileName.mime || byFileName.mode,
    };
  }

  const ext = getExt(fileName).replace(/^\./, "");
  const byExtension = ext ? CodeMirror.findModeByExtension(ext) : undefined;
  if (byExtension) {
    return {
      label: byExtension.name,
      mode: byExtension.mode,
      option: byExtension.mime || byExtension.mode,
    };
  }

  const byMime = mimeType ? CodeMirror.findModeByMIME(mimeType) : undefined;
  if (byMime) {
    return {
      label: byMime.name,
      mode: byMime.mode,
      option: byMime.mime || byMime.mode,
    };
  }

  return getFallbackModeSpec();
}

async function ensureModeLoaded(mode: string): Promise<void> {
  if (!mode || mode === "null") return;

  CodeMirror.modeURL = MODE_CDN_BASE;
  await new Promise<void>((resolve) => {
    CodeMirror.requireMode(mode, () => resolve());
  });
}

export function updateViewer(
  filePath: string,
  content: string,
  modeLabel: string,
): void {
  const info = elements.viewerInfo;
  if (info) {
    setPretextText(
      info,
      `Size: ${formatBytes(content.length)} | Syntax: ${modeLabel}`,
    );
  }
  const title = elements.viewerFileTitle;
  if (title) {
    setPretextText(title, `VIEWING: ${filePath}`);
  }
}

export async function openFile(file: FileInfo): Promise<void> {
  if (
    appState.isViewerActive &&
    appState.currentViewingFile?.path === file.path
  ) {
    return;
  }

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
    const browserFile = await file.entryHandle.getFile();
    const content = await browserFile.text();
    const modeSpec = resolveModeSpec(file.name, browserFile.type);
    await ensureModeLoaded(modeSpec.mode);

    appState.currentViewingFile = file;

    initOrSet(content, modeSpec);
    updateViewer(file.path, content, modeSpec.label);
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

function initOrSet(content: string, modeSpec: ModeSpec): void {
  const container = elements.viewerContent;
  if (!appState.viewerInstance && container) {
    appState.viewerInstance = CodeMirror(container, {
      value: content,
      mode: modeSpec.option,
      lineNumbers: true,
      theme: "material-darker",
      readOnly: true,
      lineWrapping: true,
    });
  } else if (appState.viewerInstance) {
    appState.viewerInstance.setValue(content);
    appState.viewerInstance.setOption("mode", modeSpec.option);
    appState.viewerInstance.clearHistory();
  }
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
