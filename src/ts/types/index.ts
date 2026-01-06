export interface FileInfo {
	name: string;
	type: "file";
	size: number;
	path: string;
	extension: string;
	depth: number;
	entryHandle: FileSystemFileHandle;
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
	entryHandle: FileSystemDirectoryHandle;
}

export interface ScanData {
	directoryData: FolderInfo | null;
	allFilesList: FileInfo[];
	allFoldersList: Array<{
		name: string;
		path: string;
		entryHandle: FileSystemDirectoryHandle;
	}>;
	maxDepth: number;
}

export interface AppState {
	activeTabId: string;
	fullScanData: ScanData | null;
	committedScanData: ScanData | null;
	selectionCommitted: boolean;
	processingInProgress: boolean;
	currentViewingFile: FileInfo | null;
	viewerInstance: unknown; // CodeMirror instance
	isViewerActive: boolean;
	directoryHandle: FileSystemDirectoryHandle | null;
}

export interface FileTypeData {
	ALLOW_BASENAMES: string[];
	TEXT_EXTENSIONS: string[];
}
