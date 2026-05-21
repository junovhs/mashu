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
}

export interface FileTypeData {
  ALLOW_BASENAMES: string[];
  TEXT_EXTENSIONS: string[];
}

export interface ParsedFile {
  filePath: string;
  content: string;
}
