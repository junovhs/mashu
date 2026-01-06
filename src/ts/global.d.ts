interface FileSystemHandle {
	readonly kind: "file" | "directory";
	readonly name: string;
	queryPermission(
		descriptor?: FileSystemHandlePermissionDescriptor,
	): Promise<PermissionState>;
	requestPermission(
		descriptor?: FileSystemHandlePermissionDescriptor,
	): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
	readonly kind: "file";
	getFile(): Promise<File>;
	createWritable(
		options?: FileSystemCreateWritableOptions,
	): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
	readonly kind: "directory";
	getDirectoryHandle(
		name: string,
		options?: FileSystemGetDirectoryOptions,
	): Promise<FileSystemDirectoryHandle>;
	getFileHandle(
		name: string,
		options?: FileSystemGetFileOptions,
	): Promise<FileSystemFileHandle>;
	values(): AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemHandlePermissionDescriptor {
	mode?: "read" | "readwrite";
}

interface FileSystemCreateWritableOptions {
	keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
	write(data: unknown): Promise<void>;
	seek(position: number): Promise<void>;
	truncate(size: number): Promise<void>;
}

interface FileSystemGetDirectoryOptions {
	create?: boolean;
}

interface FileSystemGetFileOptions {
	create?: boolean;
}

interface Window {
	showOpenFilePicker(options?: unknown): Promise<FileSystemFileHandle[]>;
	showDirectoryPicker(options?: unknown): Promise<FileSystemDirectoryHandle>;
}

// biome-ignore lint/suspicious/noExplicitAny: Global third-party library
declare const CodeMirror: any;
// biome-ignore lint/suspicious/noExplicitAny: Global third-party library
declare const JSZip: any;
