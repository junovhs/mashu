// =================================================================
// DirAnalyze Streamline v1.0.0 - Main Application Orchestrator
// =================================================================

import { appState, elements } from './state.js';
import { 
    populateElements, initTabs, initSidebarResizer, resetUIForProcessing,
    showFailedUI, refreshAllUI, renderTree, enableUIControls, disableUIControls,
    showNotification, setAllSelections, toggleAllFolders, closeViewer,
    openScaffoldModal, closeScaffoldModal
} from './ui.js';
import { 
    initializeFiletypeData, processDirectoryEntryRecursive, filterScanData 
} from './filesystem.js';
import { 
    downloadProjectAsZip, exportCombinedText, SCAFFOLD_PROMPT_TEMPLATE, 
    handleImportAndReconstruct, processScaffoldJsonInput 
} from './features.js';


// --- Core Application Logic ---

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

// --- Event Handlers ---

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


// --- Application Initialization ---

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
    
    // Feature-specific event listeners
    elements.importAiScaffoldBtn.addEventListener('click', openScaffoldModal);
    elements.importFromExportBtn.addEventListener('click', () => handleImportAndReconstruct(verifyAndProcessDirectory));
    elements.closeScaffoldModalBtn.addEventListener('click', closeScaffoldModal);
    elements.createProjectFromScaffoldBtn.addEventListener('click', () => processScaffoldJsonInput(verifyAndProcessDirectory));
    elements.cancelScaffoldImportBtn.addEventListener('click', closeScaffoldModal);
    elements.copyScaffoldPromptBtn.addEventListener('click', () => navigator.clipboard.writeText(SCAFFOLD_PROMPT_TEMPLATE.trim()).then(() => showNotification("Scaffold prompt copied!", 3000)));
}

async function initApp() {
    populateElements();
    
    // Fetch external data and initialize modules
    try {
        // --- THIS IS THE CORRECTED LINE ---
        const response = await fetch('public/data/filetypes.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const filetypeData = await response.json();
        initializeFiletypeData(filetypeData);
    } catch (error) {
        console.error("Fatal: Could not load filetypes.json. Text detection will be impaired.", error);
        showNotification("Error: Could not load file type data.", 5000);
    }

    initTabs();
    initSidebarResizer();
    setupEventListeners();
    disableUIControls();
    elements.pageLoader.classList.add('hidden');
    console.log("DirAnalyze Streamline v1.0.0 Initialized.");
}

document.addEventListener('DOMContentLoaded', initApp);