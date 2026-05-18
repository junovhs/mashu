import { isLikelyText, readFile, sniffIsText } from "./filesystem.js";
import { appState } from "./state.js";
import type { FileInfo } from "./types/index.js";
import { showNotification } from "./ui/index.js";

declare const JSZip: {
  new (): {
    file(path: string, data: string | Blob): void;
    generateAsync(options: { type: "blob" }): Promise<Blob>;
  };
};

export async function exportCombined() {
  if (!checkExportReady()) return;

  const candidates = appState.committedScanData?.allFilesList || [];
  const files = await getTextFiles(candidates);
  if (files.length === 0) return showNotification("No text files to export.", 3000);

  showNotification("Preparing file...", 2000);
  const content = await buildExport(files);
  downloadBlob(
    content,
    `${appState.fullScanData?.directoryData?.name}_export.txt`,
  );
}

function checkExportReady() {
  if (
    !appState.selectionCommitted ||
    !appState.committedScanData ||
    !appState.fullScanData?.directoryData
  ) {
    showNotification("Commit a selection first so Mashu knows which files to export.", 3200);
    return false;
  }
  return true;
}

async function getTextFiles(candidates: FileInfo[]) {
  const tests = candidates.map(
    async (f) => isLikelyText(f.path) || (await sniffIsText(f.entryHandle)),
  );
  const results = await Promise.all(tests);
  return candidates.filter((_, i) => results[i]);
}

async function buildExport(files: FileInfo[]) {
  let txt = `// MASHU COMBINED TEXT EXPORT //\n// Project: ${appState.fullScanData?.directoryData?.name}\n// Generated: ${new Date().toISOString()}\n\n`;
  for (const file of files) {
    const res = await readFile(file.entryHandle);
    if (res.ok) {
      txt += `// ===== START OF FILE: ${file.path} ===== //\n`;
      txt += res.value + (res.value.endsWith("\n") ? "" : "\n");
      txt += `// ===== END OF FILE: ${file.path} ===== //\n\n\n`;
    } else {
      txt += `// ERROR READING: ${file.path}: ${res.error.message} //\n\n`;
    }
  }
  return txt;
}

function downloadBlob(content: string | Blob, filename: string) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function downloadZip() {
  if (typeof JSZip === "undefined")
    return showNotification("JSZip library not loaded!", 4000);
  if (!appState.fullScanData?.directoryData)
    return showNotification("No project to download.", 3000);

  const zip = new JSZip();
  showNotification("Preparing ZIP file...", 2000);

  for (const file of appState.fullScanData.allFilesList) {
    const readResult = await readFile(file.entryHandle);
    zip.file(
      file.path,
      readResult.ok
        ? readResult.value
        : `// Error reading file: ${readResult.error.message}`,
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${appState.fullScanData.directoryData.name}.zip`);
  showNotification("ZIP download started!", 3500);
}
