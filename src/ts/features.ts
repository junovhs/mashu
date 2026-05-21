import { filterScanData, isLikelyText, readFile } from "./filesystem.js";
import { sniffIsText } from "./utils/fs_utils.js";
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
  const activeData = getExportData();
  if (!activeData) {
    showNotification("Load a project first.", 3000);
    return;
  }

  const manifest = await buildManifest(activeData.allFilesList);
  if (manifest.length === 0) return showNotification("No text files to export.", 3000);

  const label = manifest.length === 1 ? "1 file" : `${manifest.length} files`;
  showNotification(`Exporting ${label}…`, 4000);
  const blob = await assembleExportBlob(manifest);
  downloadBlob(blob, `${appState.fullScanData?.directoryData?.name}_export.txt`);
  showNotification("Export ready.", 2500);
}

function getExportData() {
  if (!appState.fullScanData?.directoryData) return null;
  if (appState.selectedPaths.size === 0) return appState.fullScanData;

  return filterScanData(appState.fullScanData, new Set(appState.selectedPaths));
}

async function buildManifest(candidates: FileInfo[]): Promise<FileInfo[]> {
  const tests = candidates.map(
    async (f) => isLikelyText(f.path) || (await sniffIsText(f.entryHandle)),
  );
  const results = await Promise.all(tests);
  return candidates.filter((_, i) => results[i]);
}

async function assembleExportBlob(manifest: FileInfo[]): Promise<Blob> {
  const parts: BlobPart[] = [
    `// MASHU COMBINED TEXT EXPORT //\n// Project: ${appState.fullScanData?.directoryData?.name}\n// Generated: ${new Date().toISOString()}\n\n`,
  ];

  for (let i = 0; i < manifest.length; i++) {
    const file = manifest[i];
    const res = await readFile(file.entryHandle);
    if (res.ok) {
      parts.push(`// ===== START OF FILE: ${file.path} ===== //\n`);
      parts.push(res.value.endsWith("\n") ? res.value : res.value + "\n");
      parts.push(`// ===== END OF FILE: ${file.path} ===== //\n\n\n`);
    } else {
      parts.push(`// ERROR READING: ${file.path}: ${res.error.message} //\n\n`);
    }

    if ((i + 1) % 50 === 0 && i + 1 < manifest.length) {
      showNotification(`Exporting… (${i + 1}/${manifest.length})`, 2000);
    }
  }

  return new Blob(parts, { type: "text/plain;charset=utf-8" });
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