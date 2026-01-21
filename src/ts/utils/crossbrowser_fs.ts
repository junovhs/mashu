/**
 * Cross-Browser File System Abstraction
 * 
 * Provides a unified interface using standard web APIs that work in all browsers:
 * - webkitGetAsEntry() for drag & drop
 * - <input webkitdirectory> for folder selection
 * 
 * No File System Access API required!
 */

// ============================================================================
// UNIFIED HANDLE TYPES
// ============================================================================

export interface VirtualFileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<File>;
}

export interface VirtualDirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  values(): AsyncIterableIterator<VirtualFileHandle | VirtualDirectoryHandle>;
}

// Internal type with map access for building
interface InternalDirectoryHandle extends VirtualDirectoryHandle {
  _children: Map<string, VirtualFileHandle | VirtualDirectoryHandle>;
}

// ============================================================================
// HANDLE CREATION
// ============================================================================

function createFileHandle(file: File): VirtualFileHandle {
  return {
    kind: "file",
    name: file.name,
    async getFile() {
      return file;
    },
  };
}

function createDirectoryHandle(
  name: string,
  children: Map<string, VirtualFileHandle | VirtualDirectoryHandle>
): InternalDirectoryHandle {
  return {
    kind: "directory",
    name,
    _children: children,
    async *values() {
      for (const value of this._children.values()) {
        yield value;
      }
    },
  };
}

// ============================================================================
// BUILD FROM FILELIST (<input webkitdirectory>)
// ============================================================================

interface FileWithPath extends File {
  readonly webkitRelativePath: string;
}

/**
 * Build a virtual directory structure from a FileList.
 * Files have webkitRelativePath like "myFolder/sub/file.txt"
 */
export function buildFromFileList(files: FileList): VirtualDirectoryHandle | null {
  console.log("[buildFromFileList] Starting with", files.length, "files");
  
  if (files.length === 0) return null;

  const firstFile = files[0] as FileWithPath;
  const firstPath = firstFile.webkitRelativePath || firstFile.name;
  console.log("[buildFromFileList] First file path:", firstPath);
  
  const rootName = firstPath.split("/")[0];
  console.log("[buildFromFileList] Root name:", rootName);

  const root = createDirectoryHandle(rootName, new Map());

  for (let i = 0; i < files.length; i++) {
    const file = files[i] as FileWithPath;
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split("/");

    let current = root;
    // Start at 1 to skip root folder name
    for (let j = 1; j < parts.length; j++) {
      const part = parts[j];
      const isFile = j === parts.length - 1;

      if (isFile) {
        current._children.set(part, createFileHandle(file));
      } else {
        if (!current._children.has(part)) {
          current._children.set(part, createDirectoryHandle(part, new Map()));
        }
        current = current._children.get(part) as InternalDirectoryHandle;
      }
    }
  }

  console.log("[buildFromFileList] Built root with", root._children.size, "children");
  return root;
}

// ============================================================================
// BUILD FROM DRAG & DROP (webkitGetAsEntry)
// ============================================================================

// FileSystem Entry API types (available in all browsers for drag & drop)
interface FSEntryBase {
  readonly name: string;
  readonly fullPath: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

interface FSFileEntry extends FSEntryBase {
  readonly isFile: true;
  readonly isDirectory: false;
  file(success: (f: File) => void, error?: (e: Error) => void): void;
}

interface FSDirectoryEntry extends FSEntryBase {
  readonly isFile: false;
  readonly isDirectory: true;
  createReader(): FSDirectoryReader;
}

interface FSDirectoryReader {
  readEntries(success: (entries: FSEntry[]) => void, error?: (e: Error) => void): void;
}

type FSEntry = FSFileEntry | FSDirectoryEntry;

/**
 * Build virtual directory handle from a dropped DataTransferItem
 * @deprecated Use buildFromEntry instead - DataTransferItem becomes invalid after async operations
 */
export async function buildFromDropItem(
  item: DataTransferItem
): Promise<VirtualDirectoryHandle | null> {
  const entry = item.webkitGetAsEntry?.() as FSEntry | null;
  if (!entry || !entry.isDirectory) {
    return null;
  }
  return processDirectory(entry as FSDirectoryEntry);
}

/**
 * Build virtual directory handle from a FileSystemEntry.
 * Use this when you've already called webkitGetAsEntry() synchronously.
 */
export async function buildFromEntry(
  entry: FileSystemEntry
): Promise<VirtualDirectoryHandle | null> {
  if (!entry || !entry.isDirectory) {
    return null;
  }
  return processDirectory(entry as unknown as FSDirectoryEntry);
}

async function processDirectory(dirEntry: FSDirectoryEntry): Promise<InternalDirectoryHandle> {
  const children = new Map<string, VirtualFileHandle | VirtualDirectoryHandle>();
  const entries = await readAllEntries(dirEntry.createReader());

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await entryToFile(entry as FSFileEntry);
      if (file) {
        children.set(entry.name, createFileHandle(file));
      }
    } else if (entry.isDirectory) {
      const subDir = await processDirectory(entry as FSDirectoryEntry);
      children.set(entry.name, subDir);
    }
  }

  return createDirectoryHandle(dirEntry.name, children);
}

function readAllEntries(reader: FSDirectoryReader): Promise<FSEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FSEntry[] = [];

    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve(all);
          } else {
            all.push(...entries);
            readBatch(); // Keep reading until empty
          }
        },
        reject
      );
    };

    readBatch();
  });
}

function entryToFile(entry: FSFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(null));
  });
}

// ============================================================================
// FOLDER PICKER (programmatic)
// ============================================================================

/**
 * Show a folder selection dialog.
 * Returns null if cancelled.
 */
export function showFolderPicker(): Promise<VirtualDirectoryHandle | null> {
  return new Promise((resolve) => {
    console.log("[showFolderPicker] Creating input element");
    
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.multiple = true;

    // Some browsers need element in DOM
    input.style.position = "fixed";
    input.style.top = "-10000px";
    input.style.left = "-10000px";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      console.log("[showFolderPicker] Change event fired");
      
      const files = input.files;
      input.remove();

      if (!files || files.length === 0) {
        console.log("[showFolderPicker] No files selected");
        resolve(null);
        return;
      }

      console.log(`[showFolderPicker] Got ${files.length} files`);
      const handle = buildFromFileList(files);
      console.log("[showFolderPicker] Built handle:", handle);
      resolve(handle);
    });

    // Note: Removed the focus-based cancel detection as it interferes with
    // browser confirmation dialogs ("Upload X files?")
    
    input.click();
  });
}
