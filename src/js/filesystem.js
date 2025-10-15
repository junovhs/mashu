// =================================================================
// DirAnalyze Streamline - File System & Data Logic
// =================================================================
// This module handles scanning directories, filtering data structures,
// reading/writing files, and utility functions for file analysis.
// It is completely decoupled from the UI.

// --- Data for text file sniffing ---
// These will be populated by the main app after fetching the JSON file.
let ALLOW_BASENAMES = new Set();
let TEXT_EXTENSIONS = new Set();

/**
 * Populates the internal sets for file type sniffing.
 * Must be called once at startup.
 * @param {object} filetypeData - The parsed JSON object from filetypes.json
 */
export function initializeFiletypeData(filetypeData) {
    ALLOW_BASENAMES = new Set(filetypeData.ALLOW_BASENAMES);
    TEXT_EXTENSIONS = new Set(filetypeData.TEXT_EXTENSIONS);
}

// --- Utility Functions ---

export function formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const BoundedI = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, BoundedI)).toFixed(dm)) + ' ' + sizes[BoundedI];
}

export function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '(no ext)';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '(no ext)';
    return filename.substring(lastDot).toLowerCase();
}

export function isLikelyTextByName(filepath) {
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

export async function sniffIsText(fileHandle, maxBytes = 8192) {
  try {
    const file = await fileHandle.getFile();
    const MAX_TEXT_BYTES = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_TEXT_BYTES) return false;
    const slice = await file.slice(0, Math.min(file.size, maxBytes)).arrayBuffer();
    const view = new Uint8Array(slice);
    for (let i = 0; i < view.length; i++) {
      if (view[i] === 0) return false; // NUL = likely binary
    }
    return true;
  } catch {
    return false;
  }
}

// --- Core File System Logic ---

export async function processDirectoryEntryRecursive(dirHandle, currentPath, depth, parentAggregator = null) {
    const ignoreList = ['.git', 'node_modules', '.vscode', '.idea', 'dist', 'build', 'target'];
    if (ignoreList.includes(dirHandle.name)) {
        const emptyDirData = { name: dirHandle.name, path: currentPath, type: 'folder', depth, children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: dirHandle };
        return depth === 0 ? { directoryData: emptyDirData, allFilesList: [], allFoldersList: [], maxDepth: 0 } : { directoryData: emptyDirData };
    }
    const dirData = { name: dirHandle.name, path: currentPath, type: 'folder', depth, children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: dirHandle };
    let aggregator = parentAggregator || { allFilesList: [], allFoldersList: [], maxDepth: depth };
    if (depth > aggregator.maxDepth) aggregator.maxDepth = depth;
    aggregator.allFoldersList.push({ name: dirData.name, path: dirData.path, entryHandle: dirData.entryHandle });
    for await (const entry of dirHandle.values()) {
        if (ignoreList.includes(entry.name)) continue;
        const entryPath = `${currentPath}/${entry.name}`;
        if (entry.kind === 'file') {
            try {
                const file = await entry.getFile();
                const fileInfo = { name: file.name, type: 'file', size: file.size, path: entryPath, extension: getFileExtension(file.name), depth: depth + 1, entryHandle: entry };
                dirData.children.push(fileInfo);
                dirData.fileCount++;
                dirData.totalSize += file.size;
                aggregator.allFilesList.push(fileInfo);
                const ext = fileInfo.extension;
                if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                dirData.fileTypes[ext].count++;
                dirData.fileTypes[ext].size += file.size;
            } catch (err) { console.warn(`Skipping file ${entry.name}: ${err.message}`); }
        } else if (entry.kind === 'directory') {
            try {
                const subResults = await processDirectoryEntryRecursive(entry, entryPath, depth + 1, aggregator);
                dirData.children.push(subResults.directoryData);
                dirData.dirCount++;
                dirData.fileCount += subResults.directoryData.fileCount;
                dirData.dirCount += subResults.directoryData.dirCount;
                dirData.totalSize += subResults.directoryData.totalSize;
                Object.entries(subResults.directoryData.fileTypes).forEach(([ext, data]) => {
                    if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                    dirData.fileTypes[ext].count += data.count;
                    dirData.fileTypes[ext].size += data.size;
                });
            } catch (err) { console.warn(`Skipping directory ${entry.name}: ${err.message}`); }
        }
    }
    return depth === 0 ? { directoryData: dirData, ...aggregator } : { directoryData: dirData };
}

export function filterScanData(fullData, selectedPathsSet) {
    if (!fullData || !fullData.directoryData) return { directoryData: null, allFilesList: [], allFoldersList: [] };
    function filterNodeRecursive(node) {
        if (node.type === 'file') return selectedPathsSet.has(node.path) ? { ...node } : null;
        const filteredChildren = node.children.map(filterNodeRecursive).filter(child => child !== null);
        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) return null;
        const filteredFolder = { ...node, children: filteredChildren };
        filteredFolder.fileCount = 0; filteredFolder.dirCount = 0; filteredFolder.totalSize = 0; filteredFolder.fileTypes = {};
        filteredChildren.forEach(fc => {
            if (fc.type === 'file') {
                filteredFolder.fileCount++; filteredFolder.totalSize += fc.size;
                const ext = fc.extension; if (!filteredFolder.fileTypes[ext]) filteredFolder.fileTypes[ext] = { count: 0, size: 0 };
                filteredFolder.fileTypes[ext].count++; filteredFolder.fileTypes[ext].size += fc.size;
            } else {
                filteredFolder.dirCount++; filteredFolder.dirCount += fc.dirCount; filteredFolder.fileCount += fc.fileCount; filteredFolder.totalSize += fc.totalSize;
                Object.entries(fc.fileTypes).forEach(([ext, data]) => {
                    if (!filteredFolder.fileTypes[ext]) filteredFolder.fileTypes[ext] = { count: 0, size: 0 };
                    filteredFolder.fileTypes[ext].count += data.count;
                    filteredFolder.fileTypes[ext].size += data.size;
                });
            }
        });
        return filteredFolder;
    }
    const filteredDirectoryData = filterNodeRecursive(fullData.directoryData);
    if (!filteredDirectoryData) return { directoryData: null, allFilesList: [], allFoldersList: [] };
    const filteredAllFiles = []; const filteredAllFolders = [];
    function collectFiltered(node, filesArr, foldersArr) {
        if (!node) return;
        if (node.type === 'file') filesArr.push({ ...node });
        else {
            foldersArr.push({ name: node.name, path: node.path, entryHandle: node.entryHandle });
            if (node.children) node.children.forEach(child => collectFiltered(child, filesArr, foldersArr));
        }
    }
    collectFiltered(filteredDirectoryData, filteredAllFiles, filteredAllFolders);
    return { ...fullData, directoryData: filteredDirectoryData, allFilesList: filteredAllFiles, allFoldersList: filteredAllFolders };
}

export async function readFileContent(fileHandle) {
    const file = await fileHandle.getFile();
    return file.text();
}

export async function writeFileContent(directoryHandle, fullPath, content) {
    const pathParts = fullPath.split('/').filter(p => p);
    const rootDirInPath = pathParts[0];
    const fileName = pathParts.pop();
    let currentHandle = directoryHandle;
    if (pathParts.length > 0) { 
        currentHandle = await directoryHandle.getDirectoryHandle(rootDirInPath, { create: true });
        for (const part of pathParts.slice(1)) {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
    } else {
        currentHandle = await directoryHandle.getDirectoryHandle(rootDirInPath, { create: true });
    }
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return directoryHandle.getDirectoryHandle(rootDirInPath);
}