import type { VirtualDirectoryHandle, VirtualFileHandle } from "../utils/crossbrowser_fs.js";

export interface FileInfo {
  name: string;
  type: "file";
  size: number;
  path: string;
  extension: string;
  depth: number;
  entryHandle: VirtualFileHandle;
}

export interface FolderInfo {
  name: string;
  type: "folder";
  path: string;
  depth: number;
  children: Array<FileInfo | FolderInfo>;
  fileCount: number;
  dirCount: number;
  totalSize: number;
  fileTypes: Record<string, { count: number; size: number }>;
  entryHandle: VirtualDirectoryHandle;
}

export interface ScanData {
  directoryData: FolderInfo | null;
  allFilesList: FileInfo[];
  allFoldersList: Array<{
    name: string;
    path: string;
    entryHandle: VirtualDirectoryHandle;
  }>;
  maxDepth: number;
}

export interface AppState {
  activeTabId: string;
  fullScanData: ScanData | null;
  treeSearchQuery: string;
  expandedFolderPaths: Set<string>;
  selectedPaths: Set<string>;
  treeNodesByPath: Map<string, FileInfo | FolderInfo>;
  treeParentPaths: Map<string, string | null>;
  subtreeNodeCounts: Map<string, number>;
  selectedSubtreeCounts: Map<string, number>;
  processingInProgress: boolean;
  currentViewingFile: FileInfo | null;
  viewerInstance: CodeMirror.Editor | null;
  isViewerActive: boolean;
  scanWorker: Worker | null;
  rustIndexReady: boolean;
}

export interface FileTypeData {
  ALLOW_BASENAMES: string[];
  TEXT_EXTENSIONS: string[];
}

export interface ParsedFile {
  filePath: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Worker message contract — all fields must be structurally cloneable.
// Browser file/directory handles MUST NOT appear here.
// ---------------------------------------------------------------------------

export interface SerializableFileEntry {
  id: string;
  kind: "file";
  name: string;
  path: string;
  size: number;
  extension: string;
  depth: number;
}

export interface SerializableFolderEntry {
  id: string;
  kind: "folder";
  name: string;
  path: string;
  depth: number;
}

export type SerializableEntry = SerializableFileEntry | SerializableFolderEntry;

export type WorkerInboundMessage =
  | { type: "ping" }
  | { type: "scan-batch"; batchId: string; entries: SerializableEntry[] }
  | { type: "compute-selection-state"; selectedFilePaths: string[] };

// Pure tree nodes (no browser handles) — built by worker, verified on main thread
export interface PureFileInfo {
  type: "file";
  name: string;
  path: string;
  size: number;
  extension: string;
  depth: number;
}

export interface PureFolderInfo {
  type: "folder";
  name: string;
  path: string;
  depth: number;
  children: Array<PureFileInfo | PureFolderInfo>;
  fileCount: number;
  dirCount: number;
  totalSize: number;
  fileTypes: Record<string, { count: number; size: number }>;
}

export type WorkerOutboundMessage =
  | { type: "pong" }
  | { type: "scan-result"; batchId: string; ok: boolean }
  | { type: "stats-ready"; batchId: string; tree: PureFolderInfo; rustIndexReady: boolean }
  | { type: "selection-state-ready"; selectedSubtreeCounts: Record<string, number>; selectedFolderPaths: string[] };
