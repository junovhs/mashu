// =================================================================
// DirAnalyze Streamline v4.0.2 - Consolidated Application Logic
// =================================================================

// --- App State & Elements ---
const appState = {
    activeTabId: 'textReportTab',
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentViewingFile: null,
    viewerInstance: null,
    isViewerActive: false,
    directoryHandle: null,
};

const elements = {};

const ICONS = {
    folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
};

// =================================================================
// --- Utility Functions ---
// =================================================================
function formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const BoundedI = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, BoundedI)).toFixed(dm)) + ' ' + sizes[BoundedI];
}

function isLikelyTextFile(filepath) {
    if (!filepath || typeof filepath !== 'string') return false;
    const textExtensions = [
        '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.html', '.htm', '.css', '.js', '.mjs', '.ts',
        '.php', '.rb', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.sh',
        '.sql', '.ini', '.conf', '.cfg', '.toml', '.env', '.gitignore', '.svg', '.liquid'
    ];
    const lowerPath = filepath.toLowerCase();
    const lastDotIndex = lowerPath.lastIndexOf('.');
    if (lastDotIndex !== -1) {
        const extension = lowerPath.substring(lastDotIndex);
        return textExtensions.includes(extension);
    }
    return false;
}

function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '(no ext)';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '(no ext)';
    return filename.substring(lastDot).toLowerCase();
}

// =================================================================
// --- Notification & Error Handling ---
// =================================================================
function showNotification(message, duration = 3000) {
    // Feature disabled by user.
    return;
}

// =================================================================
// --- Core File System Logic ---
// =================================================================
async function processDirectoryEntryRecursive(dirHandle, currentPath, depth, parentAggregator = null) {
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

function filterScanData(fullData, selectedPathsSet) {
    if (!fullData || !fullData.directoryData) return { directoryData: null, allFilesList: [], allFoldersList: [] };
    
    function filterNodeRecursive(node) {
        if (node.type === 'file') return selectedPathsSet.has(node.path) ? { ...node } : null;
        const filteredChildren = node.children.map(filterNodeRecursive).filter(child => child !== null);
        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) return null;
        
        const filteredFolder = { ...node, children: filteredChildren };
        // Recalculate stats
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

async function readFileContent(fileHandle) {
    const file = await fileHandle.getFile();
    return file.text();
}

async function writeFileContent(directoryHandle, fullPath, content) {
    const pathParts = fullPath.split('/');
    const fileName = pathParts.pop();
    let currentHandle = directoryHandle;
    for (const part of pathParts) {
        if (!part) continue; // Handles cases like leading slashes
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}


// =================================================================
// --- UI Management & Rendering ---
// =================================================================
function initTabs() {
    elements.mainViewTabs.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
    });
}

function activateTab(tabIdToActivate) {
    appState.activeTabId = tabIdToActivate;
    elements.mainViewTabs.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabIdToActivate);
    });
    elements.tabContentArea.querySelectorAll('.tab-content-item').forEach(content => {
        content.classList.toggle('active', content.id === tabIdToActivate);
        content.style.display = content.id === tabIdToActivate ? 'flex' : 'none';
    });
    refreshAllUI();
}

function refreshAllUI() {
    if (!appState.fullScanData) {
        elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER TO BEGIN</div>';
        elements.globalStats.innerHTML = '<div class="empty-notice">NO DATA</div>';
        elements.selectionSummary.style.display = 'none';
        elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        elements.textOutputEl.textContent = "// NO PROJECT LOADED //";
        elements.copyReportButton.disabled = true;
        return;
    }
    const displayData = appState.selectionCommitted ? appState.committedScanData : appState.fullScanData;

    if (!displayData || !displayData.directoryData) {
        elements.treeContainer.innerHTML = '<div class="empty-notice">NO ITEMS IN SELECTION</div>';
        elements.globalStats.innerHTML = '<div class="empty-notice">NO DATA</div>';
        elements.selectionSummary.style.display = 'none';
        elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        elements.textOutputEl.textContent = "// SELECTION IS EMPTY //";
        return;
    }
    
    updateVisualTreeFiltering();
    displayGlobalStats(displayData);
    elements.textOutputEl.textContent = generateTextReport(displayData);
    elements.copyReportButton.disabled = false;
}

function updateVisualTreeFiltering() {
    if (!appState.fullScanData || !elements.treeContainer) return;
    const committedPaths = new Set();
    if (appState.selectionCommitted && appState.committedScanData?.directoryData) {
        function collectPathsRecursive(node, pathSet) {
            if (!node) return;
            pathSet.add(node.path);
            if (node.type === 'folder' && node.children) node.children.forEach(child => collectPathsRecursive(child, pathSet));
        }
        collectPathsRecursive(appState.committedScanData.directoryData, committedPaths);
    }
    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const path = li.dataset.path;
        li.classList.remove('dimmed-uncommitted');
        if (appState.selectionCommitted && committedPaths.size > 0 && !committedPaths.has(path)) {
            li.classList.add('dimmed-uncommitted');
        }
    });
}

function displayGlobalStats(data) {
    const { directoryData, allFilesList, allFoldersList } = data;
    const totalSize = allFilesList.reduce((sum, f) => sum + f.size, 0);
    
    if (appState.selectionCommitted) {
        elements.selectionSummary.innerHTML = `Displaying stats for <strong>${allFilesList.length} selected files</strong> and <strong>${allFoldersList.length} selected folders</strong>.`;
        elements.selectionSummary.style.display = 'block';
    } else {
        elements.selectionSummary.style.display = 'none';
    }

    elements.globalStats.innerHTML = `
        <div class="stat-item"><strong>Root Folder:</strong> ${directoryData.name}</div>
        <div class="stat-item"><strong>Files in View:</strong> ${allFilesList.length}</div>
        <div class="stat-item"><strong>Folders in View:</strong> ${allFoldersList.length}</div>
        <div class="stat-item"><strong>Total Size (View):</strong> ${formatBytes(totalSize)}</div>
    `;

    const fileTypes = {};
    allFilesList.forEach(file => {
        if (!fileTypes[file.extension]) fileTypes[file.extension] = { count: 0, size: 0 };
        fileTypes[file.extension].count++;
        fileTypes[file.extension].size += file.size;
    });
    const sortedFileTypes = Object.entries(fileTypes).sort(([,a],[,b]) => b.size - a.size);
    elements.fileTypeTableBody.innerHTML = '';
    sortedFileTypes.forEach(([ext, data]) => {
        elements.fileTypeTableBody.insertRow().innerHTML = `<td>${ext}</td><td>${data.count}</td><td>${formatBytes(data.size)}</td>`;
    });
}

function generateTextReport(data) {
    if (!data || !data.directoryData) return "// NO DATA FOR REPORT //";
    const rootNode = data.directoryData;
    let report = `//--- DIRANALYSE STREAMLINE REPORT ---//\n`;
    report += `// Timestamp: ${new Date().toISOString()}\n`;
    report += `// Root: ${rootNode.name}\n\n`;
    report += `//--- DIRECTORY STRUCTURE ---\n`;
    
    function buildTextTreeRecursive(node, prefix = "", isRoot = false) {
        let entryString = isRoot ? "" : (prefix + (node.isLastChild ? "└─ " : "├─ "));
        entryString += node.name;
    
        if (node.type === 'folder') {
            entryString += `/\n`;
            const children = node.children || [];
            children.forEach((child, index) => {
                child.isLastChild = index === children.length - 1;
                const childPrefix = isRoot ? "" : (prefix + (node.isLastChild ? "    " : "│   "));
                entryString += buildTextTreeRecursive(child, childPrefix, false);
            });
        } else {
            entryString += ` (${formatBytes(node.size)})\n`;
        }
        return entryString;
    }

    report += buildTextTreeRecursive(rootNode, "", true);
    report += `//--- END OF REPORT ---//`;
    return report;
}

// =================================================================
// --- Tree View Logic ---
// =================================================================
function renderTree(node, parentULElement) {
    const li = createNodeElement(node);
    parentULElement.appendChild(li);

    if (node.type === 'folder' && node.children && node.children.length > 0) {
        const ul = document.createElement('ul');
        node.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        }).forEach(child => renderTree(child, ul));
        li.appendChild(ul);
    }
}

function createNodeElement(nodeInfo) {
    const li = document.createElement('li');
    li.className = nodeInfo.type;
    if (nodeInfo.type === 'folder') li.classList.add('collapsed');
    li.dataset.path = nodeInfo.path;
    li.dataset.selected = "true";

    const itemLine = document.createElement('div');
    itemLine.className = 'item-line';
    const itemPrefix = document.createElement('span');
    itemPrefix.className = 'item-prefix';

    const selector = document.createElement('input');
    selector.type = 'checkbox';
    selector.className = 'selector';
    selector.checked = true;
    selector.addEventListener('change', (e) => {
        updateSelectionState(li, e.target.checked);
        updateParentCheckboxStates(li.parentElement.closest('li.folder'));
    });
    itemPrefix.appendChild(selector);

    if (nodeInfo.type === 'folder') {
        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = '▸';
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            li.classList.toggle('collapsed');
            toggle.textContent = li.classList.contains('collapsed') ? '▸' : '▾';
        });
        itemPrefix.appendChild(toggle);
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.innerHTML = nodeInfo.type === 'folder' ? ICONS.folder : ICONS.file;
    itemPrefix.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = nodeInfo.name;
    nameSpan.addEventListener('click', () => {
        if (nodeInfo.type === 'file' && isLikelyTextFile(nodeInfo.path)) {
            openFileInViewer(nodeInfo);
        } else if (nodeInfo.type === 'folder') {
            li.querySelector('.folder-toggle')?.click();
        }
    });

    const statsSpan = document.createElement('span');
    statsSpan.className = 'stats';
    statsSpan.textContent = nodeInfo.type === 'folder' ? `(${nodeInfo.fileCount} files)` : `(${formatBytes(nodeInfo.size)})`;

    itemLine.appendChild(itemPrefix);
    itemLine.appendChild(nameSpan);
    itemLine.appendChild(statsSpan);
    li.appendChild(itemLine);
    return li;
}

function updateSelectionState(listItem, isSelected) {
    listItem.dataset.selected = isSelected.toString();
    const checkbox = listItem.querySelector(':scope > .item-line > .item-prefix > .selector');
    if (checkbox) {
        checkbox.checked = isSelected;
        checkbox.indeterminate = false;
    }
    listItem.querySelectorAll(':scope > ul > li').forEach(childLi => updateSelectionState(childLi, isSelected));
}

function updateParentCheckboxStates(parentListItem) {
    if (!parentListItem) return;
    const childSelectors = Array.from(parentListItem.querySelectorAll(':scope > ul > li > .item-line > .item-prefix > .selector'));
    const parentSelector = parentListItem.querySelector(':scope > .item-line > .item-prefix > .selector');
    if (childSelectors.length > 0 && parentSelector) {
        const numChecked = childSelectors.filter(s => s.checked && !s.indeterminate).length;
        const numIndeterminate = childSelectors.filter(s => s.indeterminate).length;
        
        if (numChecked === 0 && numIndeterminate === 0) {
            parentSelector.checked = false; parentSelector.indeterminate = false; parentListItem.dataset.selected = "false";
        } else if (numChecked === childSelectors.length) {
            parentSelector.checked = true; parentSelector.indeterminate = false; parentListItem.dataset.selected = "true";
        } else {
            parentSelector.checked = false; parentSelector.indeterminate = true; parentListItem.dataset.selected = "true";
        }
    }
    const grandParentLi = parentListItem.parentElement?.closest('li.folder');
    if (grandParentLi) updateParentCheckboxStates(grandParentLi);
}

function setAllSelections(isSelected) {
    if (!elements.treeContainer) return;
    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const checkbox = li.querySelector(':scope > .item-line > .item-prefix > .selector');
        if (checkbox) { checkbox.checked = isSelected; checkbox.indeterminate = false; }
        li.dataset.selected = isSelected.toString();
    });
}

function toggleAllFolders(collapse) {
    if (!elements.treeContainer) return;
    elements.treeContainer.querySelectorAll('.tree .folder').forEach(folderLi => {
        folderLi.classList.toggle('collapsed', collapse);
        const toggle = folderLi.querySelector('.folder-toggle');
        if (toggle) toggle.textContent = collapse ? '▸' : '▾';
    });
}


// =================================================================
// --- File Viewer Logic (Read-Only) ---
// =================================================================
function getCodeMirrorMode(filePath) {
    const info = CodeMirror.findModeByExtension(getFileExtension(filePath).substring(1));
    return info ? info.mode || 'text/plain' : 'text/plain';
}

function updateViewerInfoUI(filePath, content) {
    let modeName = "N/A";
    if (appState.viewerInstance) {
        const mode = appState.viewerInstance.getOption("mode");
        modeName = typeof mode === 'string' ? mode : mode?.name || "unknown";
    }
    elements.viewerInfo.textContent = `Size: ${formatBytes(content.length)} | Mode: ${modeName}`;
    elements.viewerFileTitle.textContent = `VIEWING: ${filePath}`;
}

async function openFileInViewer(fileData) {
    if (appState.isViewerActive && appState.currentViewingFile?.path === fileData.path) return;
    
    try {
        const content = await readFileContent(fileData.entryHandle);
        appState.currentViewingFile = fileData;

        if (!appState.viewerInstance) {
            appState.viewerInstance = CodeMirror(elements.viewerContent, {
                value: content,
                mode: getCodeMirrorMode(fileData.path),
                lineNumbers: true,
                theme: "material-darker",
                readOnly: true,
                lineWrapping: true,
            });
        } else {
            appState.viewerInstance.setValue(content);
            appState.viewerInstance.setOption("mode", getCodeMirrorMode(fileData.path));
            appState.viewerInstance.clearHistory();
        }

        updateViewerInfoUI(fileData.path, content);
        elements.mainViewTabs.style.display = 'none';
        elements.tabContentArea.style.display = 'none';
        elements.fileViewer.style.display = 'flex';
        appState.isViewerActive = true;
        
        setTimeout(() => appState.viewerInstance?.refresh(), 10);

    } catch (err) {
        showNotification(`Error opening file: ${err.message}`, 4000);
        console.error(`Error opening file ${fileData.path}:`, err);
    }
}

function closeViewer() {
    elements.fileViewer.style.display = 'none';
    elements.mainViewTabs.style.display = 'flex';
    elements.tabContentArea.style.display = 'flex';
    appState.isViewerActive = false;
    appState.currentViewingFile = null;
}

// =================================================================
// --- Feature-Specific Logic (Scaffold, ZIP, etc.) ---
// =================================================================

const SCAFFOLD_PROMPT_TEMPLATE = `
Please act as a project scaffolder. I need a JSON object with two main keys:
1.  "structureString": A string representing the directory structure using parentheses for nesting and commas for siblings.
    Example: "myWebApp(index.html, css(styles.css), js(app.js))"
2.  "fileContents": An array of objects, where each object has "filePath" and "content".
    Example: [{ "filePath": "myWebApp/index.html", "content": "..." }]

My project description:
[DESCRIBE YOUR PROJECT HERE]

Your JSON response:
`;

function openScaffoldModal() {
    elements.aiScaffoldJsonInput.value = '';
    elements.scaffoldImportModal.style.display = 'flex';
}
function closeScaffoldModal() {
    elements.scaffoldImportModal.style.display = 'none';
}
async function processScaffoldJsonInput() {
    const jsonString = elements.aiScaffoldJsonInput.value.trim();
    if (!jsonString) return showNotification("Scaffold JSON is empty.", 3000);
    
    let scaffoldData;
    try {
        scaffoldData = JSON.parse(jsonString);
        if (typeof scaffoldData.structureString !== 'string' || !Array.isArray(scaffoldData.fileContents)) {
            throw new Error("Invalid format. Expects 'structureString' and 'fileContents' keys.");
        }
    } catch (error) {
        return showNotification(`Invalid Scaffold JSON: ${error.message}`, 4000);
    }

    const totalSize = scaffoldData.fileContents.reduce((sum, file) => sum + (file.content?.length || 0), 0);
    const SCAFFOLD_SIZE_LIMIT_MB = 50;
    if (totalSize > SCAFFOLD_SIZE_LIMIT_MB * 1024 * 1024) {
        if (!confirm(`Warning: This scaffold will create ${formatBytes(totalSize)}, exceeding the ${SCAFFOLD_SIZE_LIMIT_MB}MB limit. Proceed?`)) {
            return;
        }
    }
    
    try {
        const destHandle = await window.showDirectoryPicker({ id: 'scaffoldDest', mode: 'readwrite' });
        closeScaffoldModal();
        resetUIForProcessing("Writing scaffold to disk...");

        const { projectName } = parseStructureString(scaffoldData.structureString);
        const projectRootHandle = await destHandle.getDirectoryHandle(projectName, { create: true });

        for (const file of scaffoldData.fileContents) {
            const relativePath = file.filePath.startsWith(projectName + '/') 
                ? file.filePath.substring(projectName.length + 1)
                : file.filePath;
            if (!relativePath) continue;
            await writeFileContent(projectRootHandle, relativePath, file.content);
        }

        showNotification(`Scaffold "${projectName}" written to disk! Now scanning...`, 3000);
        await verifyAndProcessDirectory(projectRootHandle);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error processing scaffold:", err);
            showNotification(`Error: ${err.message}`, 4000);
            showFailedUI("Scaffold creation failed.");
        } else {
            clearProjectData();
        }
    }
}

function parseStructureString(structureStr) {
    const rootNameMatch = structureStr.trim().match(/^([^(]+)\((.*)\)$/);
    if (!rootNameMatch) throw new Error("Invalid structure string format: Must be RootName(...).");
    return { projectName: rootNameMatch[1].trim() };
}

async function downloadProjectAsZip() {
    if (typeof JSZip === 'undefined') return showNotification("JSZip library not found!", 4000);
    if (!appState.fullScanData) return showNotification("No project to download.", 3000);

    const zip = new JSZip();
    showNotification("Preparing ZIP file...", 2000);

    for (const fileInfo of appState.fullScanData.allFilesList) {
        try {
            const content = await readFileContent(fileInfo.entryHandle);
            zip.file(fileInfo.path, content);
        } catch (err) {
            console.error(`Could not read ${fileInfo.path} for zipping:`, err);
            zip.file(fileInfo.path, `// Error reading this file: ${err.message}`);
        }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = appState.fullScanData.directoryData.name + '.zip';
    link.click();
    URL.revokeObjectURL(link.href);
    showNotification("ZIP download started!", 3500);
}

async function exportCombinedText() {
    if (!appState.selectionCommitted || !appState.committedScanData) return showNotification("Please commit a selection first.", 3000);
    
    const filesToExport = appState.committedScanData.allFilesList.filter(file => isLikelyTextFile(file.path));
    if (filesToExport.length === 0) return showNotification("No text files in committed selection.", 3000);
    
    showNotification("Preparing combined text file...", 2000);
    let combinedContent = `// DIRANALYZE COMBINED TEXT EXPORT //\n// Project: ${appState.fullScanData.directoryData.name}\n\n`;

    for (const file of filesToExport) {
        try {
            const content = await readFileContent(file.entryHandle);
            combinedContent += `// ===== START OF FILE: ${file.path} ===== //\n`;
            combinedContent += content + (content.endsWith('\n') ? '' : '\n');
            combinedContent += `// ===== END OF FILE: ${file.path} ===== //\n\n\n`;
        } catch (e) {
            combinedContent += `// ERROR reading ${file.path}: ${e.message} //\n\n`;
        }
    }
    
    const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${appState.fullScanData.directoryData.name}_export.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// =================================================================
// --- Main Application Setup & Event Handlers ---
// =================================================================
function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader', dropZone: 'dropZone', selectFolderBtn: 'selectFolderBtn',
        treeContainer: 'treeContainer', globalStats: 'globalStats', selectionSummary: 'selectionSummary',
        appContainer: 'appContainer', leftSidebar: 'leftSidebar', sidebarResizer: 'sidebarResizer',
        mainView: 'mainView', mainViewTabs: 'mainViewTabs', tabContentArea: 'tabContentArea',
        rightStatsPanel: 'rightStatsPanel', treeViewControls: 'treeViewControls', generalActions: 'generalActions',
        loader: 'loader', textOutputEl: 'textOutput', copyReportButton: 'copyReportButton',
        selectAllBtn: 'selectAllBtn', deselectAllBtn: 'deselectAllBtn', commitSelectionsBtn: 'commitSelectionsBtn',
        expandAllBtn: 'expandAllBtn', collapseAllBtn: 'collapseAllBtn',
        downloadProjectBtn: 'downloadProjectBtn', clearProjectBtn: 'clearProjectBtn',
        textOutputContainerOuter: 'textOutputContainerOuter',
        visualOutputContainer: 'visualOutputContainer', notification: 'notification',
        fileViewer: 'fileViewer', viewerFileTitle: 'viewerFileTitle', viewerContent: 'viewerContent',
        closeViewerBtn: 'closeViewerBtn', viewerInfo: 'viewerInfo',
        importAiScaffoldBtn: 'importAiScaffoldBtn',
        copyScaffoldPromptBtn: 'copyScaffoldPromptBtn', scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn', aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn', cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        aiDebriefingAssistantBtn: 'aiDebriefingAssistantBtn',
    };
    for (const key in elementIds) {
        const el = document.getElementById(elementIds[key]);
        if (!el) console.warn(`Element with ID '${elementIds[key]}' not found for key '${key}'!`);
        elements[key] = el;
    }
    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
}

function setupEventListeners() {
    elements.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    elements.dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); elements.dropZone.classList.add('dragover'); });
    elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('dragover'));
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.selectFolderBtn.addEventListener('click', handleFolderSelect);
    elements.commitSelectionsBtn.addEventListener('click', commitSelections);
    elements.downloadProjectBtn.addEventListener('click', downloadProjectAsZip);
    elements.clearProjectBtn.addEventListener('click', clearProjectData);
    elements.selectAllBtn.addEventListener('click', () => setAllSelections(true));
    elements.deselectAllBtn.addEventListener('click', () => setAllSelections(false));
    elements.expandAllBtn.addEventListener('click', () => toggleAllFolders(false));
    elements.collapseAllBtn.addEventListener('click', () => toggleAllFolders(true));
    elements.copyReportButton.addEventListener('click', () => navigator.clipboard.writeText(elements.textOutputEl.textContent).then(() => showNotification("Report copied!", 2000)));
    elements.closeViewerBtn.addEventListener('click', closeViewer);
    elements.aiDebriefingAssistantBtn.addEventListener('click', exportCombinedText);
    elements.importAiScaffoldBtn.addEventListener('click', openScaffoldModal);
    elements.closeScaffoldModalBtn.addEventListener('click', closeScaffoldModal);
    elements.createProjectFromScaffoldBtn.addEventListener('click', processScaffoldJsonInput);
    elements.cancelScaffoldImportBtn.addEventListener('click', closeScaffoldModal);
    elements.copyScaffoldPromptBtn.addEventListener('click', () => navigator.clipboard.writeText(SCAFFOLD_PROMPT_TEMPLATE.trim()).then(() => showNotification("Scaffold prompt copied!", 3000)));
}

async function handleFileDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('dragover');
    if (appState.processingInProgress) return;
    for (const item of event.dataTransfer.items) {
        if (typeof item.getAsFileSystemHandle === 'function') {
            try {
                const handle = await item.getAsFileSystemHandle();
                if (handle.kind === 'directory') return await verifyAndProcessDirectory(handle);
            } catch (err) {
                console.warn("Could not get handle for a dropped item:", err);
            }
        }
    }
    showNotification("Error: Please drop a single folder.", 4000);
}

async function handleFolderSelect() {
    if (appState.processingInProgress) return;
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await verifyAndProcessDirectory(handle);
    } catch (err) {
        if (err.name !== 'AbortError') showNotification(`Error: ${err.message}`, 4000);
    }
}

async function verifyAndProcessDirectory(handle) {
    try {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted' && await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
            if (await handle.queryPermission({ mode: 'read' }) !== 'granted' && await handle.requestPermission({ mode: 'read' }) !== 'granted') {
                return showNotification("Read permission also denied. Cannot process folder.", 4000);
            }
            showNotification("Write permission denied. Proceeding in read-only mode.", 4000);
        }
    } catch (err) {
        return showNotification(`Permission error: ${err.message}`, 4000);
    }

    resetUIForProcessing(`Processing '${handle.name}'...`);
    appState.directoryHandle = handle;

    try {
        appState.fullScanData = await processDirectoryEntryRecursive(handle, handle.name, 0);
        appState.committedScanData = appState.fullScanData;
        appState.selectionCommitted = true;
        elements.treeContainer.innerHTML = '';
        renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        refreshAllUI();
        enableUIControls();
    } catch (err) {
        showFailedUI("Directory processing failed.");
        console.error(err);
    } finally {
        appState.processingInProgress = false;
        elements.loader.classList.remove('visible');
    }
}

function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    appState.processingInProgress = true;
    elements.loader.textContent = loaderMsg;
    elements.loader.classList.add('visible');
    closeViewer();
    appState.fullScanData = null;
    appState.committedScanData = null;
    appState.selectionCommitted = false;
    appState.directoryHandle = null;
    elements.treeContainer.innerHTML = '<div class="empty-notice">DROP FOLDER OR IMPORT SCAFFOLD</div>';
    disableUIControls();
    activateTab('textReportTab');
}

function showFailedUI(message = "OPERATION FAILED") {
    elements.textOutputEl.textContent = message;
    activateTab('textReportTab');
    elements.loader.classList.remove('visible');
    appState.processingInProgress = false;
    enableUIControls(false); 
}

function commitSelections() {
    if (!appState.fullScanData) return;
    const selectedPaths = new Set();
    elements.treeContainer.querySelectorAll('li[data-selected="true"]').forEach(li => selectedPaths.add(li.dataset.path));
    
    appState.committedScanData = filterScanData(appState.fullScanData, selectedPaths);
    appState.selectionCommitted = true;
    refreshAllUI();
    showNotification("Selection committed.", 1500);
}

function clearProjectData() {
    resetUIForProcessing();
    elements.loader.classList.remove('visible');
    enableUIControls(false); 
}

function enableUIControls(hasData = true) {
    const buttons = ['commitSelectionsBtn', 'downloadProjectBtn', 'clearProjectBtn', 'aiDebriefingAssistantBtn', 'selectAllBtn', 'deselectAllBtn', 'expandAllBtn', 'collapseAllBtn'];
    buttons.forEach(id => { if(elements[id]) elements[id].disabled = !hasData });
    elements.importAiScaffoldBtn.disabled = false;
    elements.selectFolderBtn.disabled = false;
    elements.copyScaffoldPromptBtn.disabled = false;
}
const disableUIControls = () => enableUIControls(false);

function initSidebarResizer() {
    const { leftSidebar, sidebarResizer } = elements;
    if(!leftSidebar || !sidebarResizer) return;
    let isResizing = false;
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) leftSidebar.style.width = savedWidth;

    sidebarResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        const startX = e.clientX;
        const startWidth = parseInt(document.defaultView.getComputedStyle(leftSidebar).width, 10);
        
        function handleMouseMove(e) {
            if (!isResizing) return;
            const newWidth = startWidth + e.clientX - startX;
            leftSidebar.style.width = `${newWidth}px`;
        }

        function handleMouseUp() {
            if (!isResizing) return;
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            localStorage.setItem('sidebarWidth', leftSidebar.style.width);
            window.dispatchEvent(new CustomEvent('sidebarResized'));
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
    
    window.addEventListener('sidebarResized', () => {
        appState.viewerInstance?.refresh();
    });
}

function initApp() {
    populateElements();
    initTabs();
    initSidebarResizer();
    setupEventListeners();
    disableUIControls();
    elements.pageLoader.classList.add('hidden');
    console.log("DirAnalyze Streamline v4.0.2 Initialized.");
}

document.addEventListener('DOMContentLoaded', initApp);