import {
	formatBytes,
	isLikelyText,
	readFile,
	sniffIsText,
	writeFile,
} from "./filesystem.js";
import { appState, elements } from "./state.js";
import type { FileInfo } from "./types/index.js";
import {
	resetUIForProcessing,
	showFailedUI,
	showNotification,
} from "./ui/ui.js";
import { Err, Ok, type Result, toResult } from "./utils/result.js";

// --- Combined Text Export / Import ---

interface ParsedFile {
	filePath: string;
	content: string;
}

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

export async function processScaffold(
	verifyAndProcess: (h: FileSystemDirectoryHandle) => Promise<void>,
) {
	const json = elements.aiScaffoldJsonInput.value.trim();
	if (!json) return showNotification("JSON empty.", 3000);

	const res = parseScaffold(json);
	if (!res.ok) return showNotification(`Invalid: ${res.error.message}`, 4000);

	const data = res.value;
	if (!(await checkSize(data))) return;

	const dest = await toResult(
		window.showDirectoryPicker({ id: "scaffoldDest", mode: "readwrite" }),
	);
	if (!dest.ok) return;

	elements.scaffoldImportModal.style.display = "none";
	resetUIForProcessing("Writing...");
	await buildScaffold(
		dest.value as FileSystemDirectoryHandle,
		data,
		verifyAndProcess,
	);
}

async function checkSize(data: { fileContents: Array<{ content: string }> }) {
	const size = data.fileContents.reduce(
		(s: number, f: { content: string }) => s + (f.content?.length || 0),
		0,
	);
	if (
		size > 50 * 1024 * 1024 &&
		!confirm(`Large scaffold (${formatBytes(size)}). Proceed?`)
	)
		return false;
	return true;
}

async function buildScaffold(
	dest: FileSystemDirectoryHandle,
	data: {
		structureString: string;
		fileContents: Array<{ filePath: string; content: string }>;
	},
	v: (h: FileSystemDirectoryHandle) => Promise<void>,
) {
	try {
		const name = data.structureString.split("(")[0].trim();
		for (const file of data.fileContents) {
			await writeFile(dest, file.filePath, file.content);
		}
		const root = await dest.getDirectoryHandle(name);
		showNotification(`Scaffold "${name}" written!`, 3000);
		await v(root);
	} catch (err) {
		console.error("Scaffold error:", err);
		showFailedUI("Scaffold failed.");
	}
}

function parseScaffold(
	json: string,
): Result<{ structureString: string; fileContents: ParsedFile[] }> {
	try {
		const data = JSON.parse(json);
		if (
			typeof data.structureString !== "string" ||
			!Array.isArray(data.fileContents)
		) {
			return Err(new Error("Invalid format"));
		}
		return Ok(data);
	} catch (e) {
		return Err(e instanceof Error ? e : new Error(String(e)));
	}
}

// --- ZIP Export ---

export async function downloadZip() {
	if (typeof JSZip === "undefined")
		return showNotification("JSZip library not found!", 4000);
	if (!appState.fullScanData?.directoryData)
		return showNotification("No project to download.", 3000);

	// biome-ignore lint/suspicious/noExplicitAny: External library instantiation
	const zip = new (JSZip as any)();
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
