// Extend File to include webkitRelativePath (used by <input webkitdirectory>)
interface File {
  readonly webkitRelativePath: string;
}

// webkitGetAsEntry for drag & drop
interface DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null;
}

// FileSystem Entry API types (for drag & drop)
interface FileSystemEntry {
  readonly name: string;
  readonly fullPath: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

interface FileSystemFileEntry extends FileSystemEntry {
  readonly isFile: true;
  readonly isDirectory: false;
  file(
    successCallback: (file: File) => void,
    errorCallback?: (err: DOMException) => void
  ): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  readonly isFile: false;
  readonly isDirectory: true;
  createReader(): FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (err: DOMException) => void
  ): void;
}

// CodeMirror types
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

// JSZip types
interface JSZip {
  file(path: string, data: string | Blob | Promise<string | Blob>): void;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

declare const JSZip: {
  new (): JSZip;
};
