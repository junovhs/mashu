import {
	isLikelyText,
	readFile,
	sniffIsText,
	writeFile,
} from "./filesystem.js";
import { appState } from "./state.js";
import type { FileInfo, ParsedFile } from "./types/index.js";
import {
	resetUIForProcessing,
	showFailedUI,
	showNotification,
} from "./ui/index.js";
import { toResult } from "./utils/result.js";

function isValid(content: string): boolean {
	return content.startsWith("// DIRANALYZE COMBINED TEXT EXPORT //");
}

function parseExport(content: string): ParsedFile[] | null {
	if (!isValid(content)) return null;
	const files: ParsedFile[] = [];
	const blockRegex =
		/\/\/ ===== START OF FILE: (.*?) ===== \/\/\n([\s\S]*?)\n\/\/ ===== END OF FILE: \1 ===== \/\//g;
	let match: RegExpExecArray | null;
	while (true) {
		match = blockRegex.exec(content);
		if (match === null) break;
		files.push({ filePath: match[1], content: match[2] });
	}
	return files;
}

export async function handleImport(
	verifyAndProcess: (h: FileSystemDirectoryHandle) => Promise<void>,
) {
	if (appState.processingInProgress) return;

	const res = await pickFile();
	if (!res) return;

	const parsed = parseExport(res.content);
	if (!parsed || parsed.length === 0)
		return showNotification("Invalid format.", 4000);

	const dest = await toResult(
		window.showDirectoryPicker({ id: "reconstructDest", mode: "readwrite" }),
	);
	if (!dest.ok) return;

	resetUIForProcessing("Reconstructing...");
	const root = await buildRoot(dest.value, parsed);

	if (root) {
		showNotification(`Done! Scanning...`, 3000);
		await verifyAndProcess(root);
	} else {
		showFailedUI("Reconstruction failed.");
	}
}

async function pickFile() {
	const res = await toResult(
		window.showOpenFilePicker({
			types: [
				{
					description: "DirAnalyze Export",
					accept: { "text/plain": [".txt"] },
				},
			],
			multiple: false,
		}),
	);
	if (!res.ok) return null;
	const [h] = res.value;
	return { name: h.name, content: await (await h.getFile()).text() };
}

async function buildRoot(dest: FileSystemDirectoryHandle, files: ParsedFile[]) {
	let root: FileSystemDirectoryHandle | null = null;
	for (const file of files) {
		await writeFile(dest, file.filePath, file.content);
		if (!root) {
			const name = file.filePath.split("/")[0];
			const res = await toResult(dest.getDirectoryHandle(name));
			if (res.ok) root = res.value;
		}
	}
	return root;
}

export async function exportCombined() {
	if (!checkExportReady()) return;

	const candidates = appState.committedScanData?.allFilesList || [];
	const files = await getFiles(candidates);
	if (files.length === 0) return showNotification("No text files.", 3000);

	showNotification("Preparing file...", 2000);
	const content = await buildExport(files);
	downloadBlob(
		content,
		`${appState.fullScanData?.directoryData?.name}_export.txt`,
	);
}

function checkExportReady() {
	if (
		!appState.selectionCommitted ||
		!appState.committedScanData ||
		!appState.fullScanData?.directoryData
	) {
		showNotification("Commit selection first.", 3000);
		return false;
	}
	return true;
}

async function getFiles(candidates: FileInfo[]) {
	const tests = candidates.map(
		async (f) => isLikelyText(f.path) || (await sniffIsText(f.entryHandle)),
	);
	const results = await Promise.all(tests);
	return candidates.filter((_, i) => results[i]);
}

async function buildExport(files: FileInfo[]) {
	let txt = `// DIRANALYZE COMBINED TEXT EXPORT //\n// Project: ${appState.fullScanData?.directoryData?.name}\n\n`;
	for (const file of files) {
		const res = await readFile(file.entryHandle);
		if (res.ok) {
			txt += `// ===== START OF FILE: ${file.path} ===== //\n`;
			txt += res.value + (res.value.endsWith("\n") ? "" : "\n");
			txt += `// ===== END OF FILE: ${file.path} ===== //\n\n\n`;
		} else {
			txt += `// ERROR: ${file.path}: ${res.error.message} //\n\n`;
		}
	}
	return txt;
}

function downloadBlob(content: string | Blob, filename: string) {
	const blob =
		content instanceof Blob
			? content
			: new Blob([content], { type: "text/plain;charset=utf-8" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	URL.revokeObjectURL(link.href);
}

export async function downloadZip() {
	if (typeof JSZip === "undefined")
		return showNotification("JSZip library not found!", 4000);
	if (!appState.fullScanData?.directoryData)
		return showNotification("No project to download.", 3000);

	// @ts-ignore: JSZip is loaded via CDN in index.html
	const zip = new JSZip();
	showNotification("Preparing ZIP file...", 2000);

	for (const file of appState.fullScanData.allFilesList) {
		const readResult = await readFile(file.entryHandle);
		zip.file(
			file.path,
			readResult.ok
				? readResult.value
				: `// Error: ${readResult.error.message}`,
		);
	}

	const zipBlob = await zip.generateAsync({ type: "blob" });
	downloadBlob(zipBlob, `${appState.fullScanData.directoryData.name}.zip`);
	showNotification("ZIP download started!", 3500);
}
