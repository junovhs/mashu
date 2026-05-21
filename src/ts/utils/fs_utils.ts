import type { VirtualFileHandle } from "./crossbrowser_fs.js";
import { toResult } from "./result.js";

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes) || bytes < 0)
    return "0 Bytes";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const BoundedI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / k ** BoundedI).toFixed(dm))} ${sizes[BoundedI]}`;
}

export function getExt(filename: string): string {
  if (!filename || typeof filename !== "string") return "(no ext)";
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1)
    return "(no ext)";
  return filename.substring(lastDot).toLowerCase();
}

let ALLOW_BASENAMES = new Set<string>();
let TEXT_EXTENSIONS = new Set<string>();

export function initTypeData(filetypeData: {
  ALLOW_BASENAMES: string[];
  TEXT_EXTENSIONS: string[];
}): void {
  ALLOW_BASENAMES = new Set(filetypeData.ALLOW_BASENAMES);
  TEXT_EXTENSIONS = new Set(filetypeData.TEXT_EXTENSIONS);
}

export function isLikelyText(filepath: string): boolean {
  if (!filepath || typeof filepath !== "string") return false;
  const lower = filepath.toLowerCase();
  const base = lower.split(/[\\/]/).pop() || lower;
  if (ALLOW_BASENAMES.has(base)) return true;
  const dot = base.lastIndexOf(".");
  if (dot !== -1) {
    const ext = base.slice(dot);
    if (TEXT_EXTENSIONS.has(ext)) return true;
  }
  return false;
}

export async function sniffIsText(
  fileHandle: VirtualFileHandle,
  maxBytes = 8192,
): Promise<boolean> {
  const result = await toResult(fileHandle.getFile());
  if (!result.ok) return false;

  const file = result.value;
  const MAX_TEXT_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_TEXT_BYTES) return false;

  const sliceResult = await toResult(
    file.slice(0, Math.min(file.size, maxBytes)).arrayBuffer(),
  );
  if (!sliceResult.ok) return false;

  const view = new Uint8Array(sliceResult.value);
  return !view.includes(0); // NUL = likely binary
}