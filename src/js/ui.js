// =================================================================
// DirAnalyze Streamline - UI Management & Rendering
// =================================================================
// This module contains all functions that interact with the DOM.
// It is responsible for rendering the tree, updating stats, managing tabs,
// modals, the file viewer, and all other visual components.

import { appState, elements, ICONS } from './state.js';
import { formatBytes, getFileExtension, isLikelyTextByName, sniffIsText, readFileContent } from './filesystem.js';

// --- Element Population ---
export function populateElements() {
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
        importFromExportBtn: 'importFromExportBtn',
        copyScaffoldPromptBtn: 'copyScaffoldPromptBtn', scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn', aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn', cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        aiDebriefingAssistantBtn: 'aiDebriefingAssistantBtn',
    };
    for (const key in elementIds) {
        elements[key] = document.getElementById(elementIds[key]);
    }
    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
}

// --- Notification & Error Handling ---
export function showNotification(message, duration = 3000) {
    // Feature disabled by user.
    // TODO: This should be re-enabled as a top priority.
    console.log(`[Notification]: ${message}`);
    return;
}

// --- High-Level UI State Management ---

export function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    appState.processingInProgress = true;
    elements.loader.textContent = loaderMsg;
    elements.loader.classList.add('visible');
    closeViewer();
    appState.fullScanData = null;
    appState.committedScanData = null;
    appState.selectionCommitted = false;
    appState.directoryHandle = null;
    elements.treeContainer.innerHTML = '<div class="empty-notice">DROP FOLDER OR IMPORT</div>';
    disableUIControls();
    activateTab('textReportTab');
}

export function showFailedUI(message = "OPERATION FAILED") {
    elements.textOutputEl.textContent = message;
    activateTab('textReportTab');
    elements.loader.classList.remove('visible');
    appState.processingInProgress = false;
    enableUIControls(false); 
}

export function enableUIControls(hasData = true) {
    const buttons = ['commitSelectionsBtn', 'downloadProjectBtn', 'clearProjectBtn', 'aiDebriefingAssistantBtn', 'selectAllBtn', 'deselectAllBtn', 'expandAllBtn', 'collapseAllBtn'];
    buttons.forEach(id => { if(elements[id]) elements[id].disabled = !hasData });
    elements.importAiScaffoldBtn.disabled = false;
    elements.importFromExportBtn.disabled = false; 
    elements.selectFolderBtn.disabled = false;
    elements.copyScaffoldPromptBtn.disabled = false;
}
export const disableUIControls = () => {
    enableUIControls(false);
    elements.importAiScaffoldBtn.disabled = false;
    elements.importFromExportBtn.disabled = false;
    elements.selectFolderBtn.disabled = false;
    elements.copyScaffoldPromptBtn.disabled = false;
};

// --- Tab & Main View Management ---

export function initTabs() {
    elements.mainViewTabs.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
    });
}

export function activateTab(tabIdToActivate) {
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

export function refreshAllUI() {
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

// --- Tree View Rendering & Interaction ---

export function renderTree(node, parentULElement) {
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
    nameSpan.addEventListener('click', async () => {
        if (nodeInfo.type === 'file') {
            if (isLikelyTextByName(nodeInfo.path) || await sniffIsText(nodeInfo.entryHandle)) {
                openFileInViewer(nodeInfo);
            } else {
                showNotification("That file doesn't look like text.", 2500);
            }
        } else {
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

export function setAllSelections(isSelected) {
    if (!elements.treeContainer) return;
    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const checkbox = li.querySelector(':scope > .item-line > .item-prefix > .selector');
        if (checkbox) { checkbox.checked = isSelected; checkbox.indeterminate = false; }
        li.dataset.selected = isSelected.toString();
    });
}

export function toggleAllFolders(collapse) {
    if (!elements.treeContainer) return;
    elements.treeContainer.querySelectorAll('.tree .folder').forEach(folderLi => {
        folderLi.classList.toggle('collapsed', collapse);
        const toggle = folderLi.querySelector('.folder-toggle');
        if (toggle) toggle.textContent = collapse ? '▸' : '▾';
    });
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


// --- Stats & Report Rendering ---

function displayGlobalStats(data) {
    const { directoryData, allFilesList, allFoldersList } = data;
    const totalSize = allFilesList.reduce((sum, f) => sum + f.size, 0);
    
    if (appState.selectionCommitted) {
        elements.selectionSummary.innerHTML = `Displaying stats for <strong>${allFilesList.length} selected files</strong> and <strong>${allFoldersList.length} selected folders}</strong>.`;
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


// --- File Viewer Logic ---

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

export function closeViewer() {
    elements.fileViewer.style.display = 'none';
    elements.mainViewTabs.style.display = 'flex';
    elements.tabContentArea.style.display = 'flex';
    appState.isViewerActive = false;
    appState.currentViewingFile = null;
}

// --- Modals & Sidebar ---

export function openScaffoldModal() {
    elements.aiScaffoldJsonInput.value = '';
    elements.scaffoldImportModal.style.display = 'flex';
}
export function closeScaffoldModal() {
    elements.scaffoldImportModal.style.display = 'none';
}

export function initSidebarResizer() {
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