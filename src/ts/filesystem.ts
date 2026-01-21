import type { FileInfo, FolderInfo, ScanData } from "./types/index.js";
import type { VirtualDirectoryHandle, VirtualFileHandle } from "./utils/crossbrowser_fs.js";
import { getExt } from "./utils/fs_utils.js";
import { Err, Ok, type Result, toResult } from "./utils/result.js";

export {
  formatBytes,
  getExt,
  initTypeData,
  isLikelyText,
  sniffIsText,
} from "./utils/fs_utils.js";

export interface ScanAggregator {
  allFilesList: FileInfo[];
  allFoldersList: Array<{
    name: string;
    path: string;
    entryHandle: VirtualDirectoryHandle;
  }>;
  maxDepth: number;
}

const IGNORE_LIST = [
  ".git",
  "node_modules",
  ".vscode",
  ".idea",
  "dist",
  "build",
  "target",
  "__pycache__",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
];

export async function scanDir(
  dirHandle: VirtualDirectoryHandle,
  currentPath: string,
  depth: number,
  aggregator?: ScanAggregator,
): Promise<Result<FolderInfo>> {
  const localAggregator = aggregator || {
    allFilesList: [],
    allFoldersList: [],
    maxDepth: depth,
  };

  if (IGNORE_LIST.includes(dirHandle.name)) {
    return Ok(emptyFolder(dirHandle, currentPath, depth));
  }

  const dirData: FolderInfo = emptyFolder(dirHandle, currentPath, depth);
  if (depth > localAggregator.maxDepth) localAggregator.maxDepth = depth;
  localAggregator.allFoldersList.push({
    name: dirData.name,
    path: dirData.path,
    entryHandle: dirData.entryHandle,
  });

  for await (const entry of dirHandle.values()) {
    if (IGNORE_LIST.includes(entry.name)) continue;
    const entryPath = `${currentPath}/${entry.name}`;

    if (entry.kind === "file") {
      await handleFileEntry(
        entry as VirtualFileHandle,
        entryPath,
        depth,
        dirData,
        localAggregator,
      );
    } else if (entry.kind === "directory") {
      await handleDirEntry(
        entry as VirtualDirectoryHandle,
        entryPath,
        localAggregator,
        depth,
        dirData,
      );
    }
  }

  return Ok(dirData);
}

function emptyFolder(
  handle: VirtualDirectoryHandle,
  path: string,
  depth: number,
): FolderInfo {
  return {
    name: handle.name,
    path,
    type: "folder",
    depth,
    children: [],
    fileCount: 0,
    dirCount: 0,
    totalSize: 0,
    fileTypes: {},
    entryHandle: handle,
  };
}

async function handleFileEntry(
  entry: VirtualFileHandle,
  path: string,
  depth: number,
  parent: FolderInfo,
  agg: ScanAggregator,
) {
  const fileResult = await toResult(entry.getFile());
  if (!fileResult.ok) return;

  const file = fileResult.value;
  const ext = getExt(file.name);
  const fileInfo: FileInfo = {
    name: file.name,
    type: "file",
    size: file.size,
    path,
    extension: ext,
    depth: depth + 1,
    entryHandle: entry,
  };

  parent.children.push(fileInfo);
  parent.fileCount++;
  parent.totalSize += file.size;
  agg.allFilesList.push(fileInfo);

  if (!parent.fileTypes[ext]) parent.fileTypes[ext] = { count: 0, size: 0 };
  parent.fileTypes[ext].count++;
  parent.fileTypes[ext].size += file.size;
}

async function handleDirEntry(
  entry: VirtualDirectoryHandle,
  path: string,
  agg: ScanAggregator,
  depth: number,
  parent: FolderInfo,
) {
  const subResult = await scanDir(entry, path, depth + 1, agg);
  if (!subResult.ok) return;

  const subData = subResult.value;
  parent.children.push(subData);
  parent.dirCount += 1 + subData.dirCount;
  parent.fileCount += subData.fileCount;
  parent.totalSize += subData.totalSize;

  mergeTypes(parent, subData.fileTypes);
}

function mergeTypes(
  parent: FolderInfo,
  subTypes: Record<string, { count: number; size: number }>,
) {
  Object.entries(subTypes).forEach(([ext, data]) => {
    if (!parent.fileTypes[ext]) parent.fileTypes[ext] = { count: 0, size: 0 };
    parent.fileTypes[ext].count += data.count;
    parent.fileTypes[ext].size += data.size;
  });
}

export function filterScanData(
  fullData: ScanData,
  selectedPaths: Set<string>,
): ScanData {
  if (!fullData.directoryData)
    return {
      ...fullData,
      directoryData: null,
      allFilesList: [],
      allFoldersList: [],
    };

  const filteredNode = filterNode(fullData.directoryData, selectedPaths);
  if (!filteredNode)
    return {
      ...fullData,
      directoryData: null,
      allFilesList: [],
      allFoldersList: [],
    };

  const { files, folders } = collectNodes(filteredNode);
  return {
    ...fullData,
    directoryData: filteredNode as FolderInfo,
    allFilesList: files,
    allFoldersList: folders,
  };
}

function filterNode(
  node: FileInfo | FolderInfo,
  selectedPaths: Set<string>,
): FileInfo | FolderInfo | null {
  if (node.type === "file")
    return selectedPaths.has(node.path) ? { ...node } : null;

  const filteredChildren = node.children
    .map((child) => filterNode(child, selectedPaths))
    .filter((child): child is FileInfo | FolderInfo => child !== null);

  if (!selectedPaths.has(node.path) && filteredChildren.length === 0)
    return null;

  const folder = { ...node, children: filteredChildren } as FolderInfo;
  fixStats(folder);
  return folder;
}

function fixStats(folder: FolderInfo) {
  folder.fileCount = 0;
  folder.dirCount = 0;
  folder.totalSize = 0;
  folder.fileTypes = {};
  folder.children.forEach((child) => {
    if (child.type === "file") {
      updateFileStat(folder, child);
    } else {
      updateDirStat(folder, child);
    }
  });
}

function updateFileStat(folder: FolderInfo, child: FileInfo) {
  folder.fileCount++;
  folder.totalSize += child.size;
  const ext = child.extension;
  if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
  folder.fileTypes[ext].count++;
  folder.fileTypes[ext].size += child.size;
}

function updateDirStat(folder: FolderInfo, child: FolderInfo) {
  folder.dirCount += 1 + child.dirCount;
  folder.fileCount += child.fileCount;
  folder.totalSize += child.totalSize;
  mergeTypes(folder, child.fileTypes);
}

function collectNodes(node: FileInfo | FolderInfo) {
  const files: FileInfo[] = [];
  const folders: Array<{
    name: string;
    path: string;
    entryHandle: VirtualDirectoryHandle;
  }> = [];

  function walk(n: FileInfo | FolderInfo) {
    if (n.type === "file") files.push(n);
    else {
      folders.push({ name: n.name, path: n.path, entryHandle: n.entryHandle });
      n.children.forEach(walk);
    }
  }
  walk(node);
  return { files, folders };
}

export async function readFile(
  handle: VirtualFileHandle,
): Promise<Result<string>> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    return Ok(text);
  } catch (error) {
    console.error("readFile failed:", error);
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}
