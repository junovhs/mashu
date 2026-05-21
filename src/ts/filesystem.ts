import type { FileInfo, FolderInfo, ScanData } from "./types/index.js";
import type { VirtualDirectoryHandle, VirtualFileHandle } from "./utils/crossbrowser_fs.js";
import { getExt } from "./utils/fs_utils.js";
import { Err, Ok, type Result } from "./utils/result.js";

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

const YIELD_EVERY = 200;

interface FileWithPath extends File {
  readonly webkitRelativePath: string;
}

async function yieldToMainThread(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createVirtualFileHandle(file: File): VirtualFileHandle {
  return {
    kind: "file",
    name: file.name,
    size: file.size,
    async getFile() {
      return file;
    },
  };
}

function createVirtualDirectoryHandle(name: string): VirtualDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      return;
    },
  };
}

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

  let processedEntries = 0;
  for await (const entry of dirHandle.values()) {
    if (IGNORE_LIST.includes(entry.name)) continue;
    const entryPath = `${currentPath}/${entry.name}`;

    if (entry.kind === "file") {
      handleFileEntry(
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

    processedEntries++;
    if (processedEntries % YIELD_EVERY === 0) {
      await yieldToMainThread();
    }
  }

  return Ok(dirData);
}

export async function scanFileList(
  files: FileList,
): Promise<Result<ScanData>> {
  if (files.length === 0) {
    return Err(new Error("No files supplied for scan."));
  }

  const firstFile = files[0] as FileWithPath;
  const firstPath = firstFile.webkitRelativePath || firstFile.name;
  const rootName = firstPath.split("/")[0];
  const root: FolderInfo = {
    name: rootName,
    path: rootName,
    type: "folder",
    depth: 0,
    children: [],
    fileCount: 0,
    dirCount: 0,
    totalSize: 0,
    fileTypes: {},
    entryHandle: createVirtualDirectoryHandle(rootName),
  };

  const foldersByPath = new Map<string, FolderInfo>([[root.path, root]]);
  const childFolderPaths = new Map<string, Set<string>>([[root.path, new Set()]]);
  const allFilesList: FileInfo[] = [];
  const allFoldersList: Array<{
    name: string;
    path: string;
    entryHandle: VirtualDirectoryHandle;
  }> = [{ name: root.name, path: root.path, entryHandle: root.entryHandle }];
  let maxDepth = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i] as FileWithPath;
    const rawPath = file.webkitRelativePath || `${rootName}/${file.name}`;
    const parts = rawPath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let currentFolder = root;
    let currentPath = root.path;

    for (let j = 1; j < parts.length - 1; j++) {
      const folderName = parts[j];
      currentPath = `${currentPath}/${folderName}`;
      let folder = foldersByPath.get(currentPath);

      if (!folder) {
        folder = {
          name: folderName,
          path: currentPath,
          type: "folder",
          depth: j,
          children: [],
          fileCount: 0,
          dirCount: 0,
          totalSize: 0,
          fileTypes: {},
          entryHandle: createVirtualDirectoryHandle(folderName),
        };
        foldersByPath.set(currentPath, folder);
        childFolderPaths.set(currentPath, new Set());
        allFoldersList.push({
          name: folder.name,
          path: folder.path,
          entryHandle: folder.entryHandle,
        });

        const knownChildren = childFolderPaths.get(currentFolder.path);
        if (knownChildren && !knownChildren.has(folder.path)) {
          currentFolder.children.push(folder);
          knownChildren.add(folder.path);
        }

        let ancestor: FolderInfo | undefined = currentFolder;
        while (ancestor) {
          ancestor.dirCount++;
          const parentPath: string | null =
            ancestor.path.includes("/") ?
              ancestor.path.slice(0, ancestor.path.lastIndexOf("/"))
            : null;
          ancestor = parentPath ? foldersByPath.get(parentPath) : undefined;
        }
      }

      currentFolder = folder;
      if (folder.depth > maxDepth) {
        maxDepth = folder.depth;
      }
    }

    const fileName = parts[parts.length - 1];
    const fileInfo: FileInfo = {
      name: fileName,
      type: "file",
      size: file.size,
      path: rawPath,
      extension: getExt(fileName),
      depth: parts.length - 1,
      entryHandle: createVirtualFileHandle(file),
    };

    currentFolder.children.push(fileInfo);
    allFilesList.push(fileInfo);
    if (fileInfo.depth > maxDepth) {
      maxDepth = fileInfo.depth;
    }

    let ancestor: FolderInfo | undefined = currentFolder;
    while (ancestor) {
      ancestor.fileCount++;
      ancestor.totalSize += fileInfo.size;
      if (!ancestor.fileTypes[fileInfo.extension]) {
        ancestor.fileTypes[fileInfo.extension] = { count: 0, size: 0 };
      }
      ancestor.fileTypes[fileInfo.extension].count++;
      ancestor.fileTypes[fileInfo.extension].size += fileInfo.size;

      const parentPath: string | null =
        ancestor.path.includes("/") ?
          ancestor.path.slice(0, ancestor.path.lastIndexOf("/"))
        : null;
      ancestor = parentPath ? foldersByPath.get(parentPath) : undefined;
    }

    if ((i + 1) % YIELD_EVERY === 0) {
      await yieldToMainThread();
    }
  }

  return Ok({
    directoryData: root,
    allFilesList,
    allFoldersList,
    maxDepth,
  });
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

function handleFileEntry(
  entry: VirtualFileHandle,
  path: string,
  depth: number,
  parent: FolderInfo,
  agg: ScanAggregator,
) {
  const ext = getExt(entry.name);
  const fileInfo: FileInfo = {
    name: entry.name,
    type: "file",
    size: entry.size,
    path,
    extension: ext,
    depth: depth + 1,
    entryHandle: entry,
  };

  parent.children.push(fileInfo);
  parent.fileCount++;
  parent.totalSize += entry.size;
  agg.allFilesList.push(fileInfo);

  if (!parent.fileTypes[ext]) parent.fileTypes[ext] = { count: 0, size: 0 };
  parent.fileTypes[ext].count++;
  parent.fileTypes[ext].size += entry.size;
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