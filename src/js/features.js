// =================================================================
// DirAnalyze Streamline - Feature-Specific Logic
// =================================================================
// This module contains the logic for complex, self-contained features
// like project scaffolding, ZIP export, and combined text import/export.

import { appState, elements } from './state.js';
import { showNotification, resetUIForProcessing, showFailedUI } from './ui.js';
import { readFileContent, writeFileContent, isLikelyTextByName, sniffIsText } from './filesystem.js';

// --- Combined Text Export / Import ---

function parseCombinedExport(fileContent) {
    if (!fileContent.startsWith('// DIRANALYZE COMBINED TEXT EXPORT //')) {
        return null; // Invalid format
    }
    const files = [];
    const fileBlockRegex = /\/\/ ===== START OF FILE: (.*?) ===== \/\/\n([\s\S]*?)\n\/\/ ===== END OF FILE: \1 ===== \/\//g;
    let match;
    while ((match = fileBlockRegex.exec(fileContent)) !== null) {
        files.push({
            filePath: match[1],
            content: match[2]
        });
    }
    return files;
}

export async function handleImportAndReconstruct(verifyAndProcessDirectory) {
    if (appState.processingInProgress) return;
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'DirAnalyze Export Files', accept: { 'text/plain': ['.txt'] } }],
            multiple: false,
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        const parsedFiles = parseCombinedExport(content);
        if (!parsedFiles || parsedFiles.length === 0) {
            showNotification("Invalid or empty export file format.", 4000);
            return;
        }
        const destHandle = await window.showDirectoryPicker({ id: 'reconstructDest', mode: 'readwrite' });
        resetUIForProcessing("Reconstructing project...");
        let projectRootHandle = null;
        for (const file of parsedFiles) {
            const handle = await writeFileContent(destHandle, file.filePath, file.content);
            if (!projectRootHandle) {
                projectRootHandle = handle;
            }
        }
        showNotification(`Project reconstructed! Now scanning...`, 3000);
        if (projectRootHandle) {
            await verifyAndProcessDirectory(projectRootHandle);
        } else {
             throw new Error("Could not determine the project's root directory after reconstruction.");
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error during project reconstruction:", err);
            showNotification(`Error: ${err.message}`, 4000);
            showFailedUI("Project reconstruction failed.");
        }
    }
}

export async function exportCombinedText() {
    if (!appState.selectionCommitted || !appState.committedScanData)
        return showNotification("Please commit a selection first.", 3000);
    const candidates = appState.committedScanData.allFilesList;
    const tests = candidates.map(async f =>
        isLikelyTextByName(f.path) ? true : await sniffIsText(f.entryHandle)
    );
    const results = await Promise.all(tests);
    const filesToExport = candidates.filter((_, i) => results[i]);
    if (filesToExport.length === 0)
        return showNotification("No text files in committed selection.", 3000);
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

// --- AI Project Scaffolding ---

export const SCAFFOLD_PROMPT_TEMPLATE = `
Please act as a project scaffolder. I need a JSON object with two main keys:
1.  "structureString": A string representing the directory structure using parentheses for nesting and commas for siblings.
    Example: "myWebApp(index.html, css(styles.css), js(app.js))"
2.  "fileContents": An array of objects, where each object has "filePath" and "content".
    Example: [{ "filePath": "myWebApp/index.html", "content": "..." }]

My project description:
[DESCRIBE YOUR PROJECT HERE]

Your JSON response:
`;

function parseStructureString(structureStr) {
    const rootNameMatch = structureStr.trim().match(/^([^(]+)\((.*)\)$/);
    if (!rootNameMatch) throw new Error("Invalid structure string format: Must be RootName(...).");
    return { projectName: rootNameMatch[1].trim() };
}

export async function processScaffoldJsonInput(verifyAndProcessDirectory) {
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
        elements.scaffoldImportModal.style.display = 'none'; // Direct UI interaction, acceptable for modal closing
        resetUIForProcessing("Writing scaffold to disk...");
        const { projectName } = parseStructureString(scaffoldData.structureString);
        for (const file of scaffoldData.fileContents) {
            await writeFileContent(destHandle, file.filePath, file.content);
        }
        const projectRootHandle = await destHandle.getDirectoryHandle(projectName);
        showNotification(`Scaffold "${projectName}" written to disk! Now scanning...`, 3000);
        await verifyAndProcessDirectory(projectRootHandle);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error processing scaffold:", err);
            showNotification(`Error: ${err.message}`, 4000);
            showFailedUI("Scaffold creation failed.");
        }
    }
}

// --- ZIP Export ---

export async function downloadProjectAsZip() {
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