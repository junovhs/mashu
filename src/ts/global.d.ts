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

// Extend the existing interface
interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
}

declare namespace CodeMirror {
  interface Editor {
    refresh(): void;
    setValue(content: string): void;
    setOption(name: string, value: unknown): void;
    getOption(name: string): unknown;
    clearHistory(): void;
  }
  function findModeByExtension(
    ext: string,
  ): { mode: string; name: string } | undefined;
}

declare function CodeMirror(
  host: HTMLElement,
  options?: unknown,
): CodeMirror.Editor;

interface JSZip {
  file(path: string, data: string | Blob | Promise<string | Blob>): void;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

declare const JSZip: {
  new (): JSZip;
};
