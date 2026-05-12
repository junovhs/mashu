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
  readonly size: number;
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

const YIELD_EVERY = 200;

async function yieldToMainThread(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// ============================================================================
// HANDLE CREATION
// ============================================================================

function createFileHandle(file: File): VirtualFileHandle {
  return {
    kind: "file",
    name: file.name,
    size: file.size,
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

function createEntryDirectoryHandle(
  dirEntry: FSDirectoryEntry,
): VirtualDirectoryHandle {
  let cachedChildrenPromise:
    | Promise<Array<VirtualFileHandle | VirtualDirectoryHandle>>
    | null = null;

  const loadChildren = async (): Promise<
    Array<VirtualFileHandle | VirtualDirectoryHandle>
  > => {
    if (cachedChildrenPromise) {
      return cachedChildrenPromise;
    }

    cachedChildrenPromise = (async () => {
      const children: Array<VirtualFileHandle | VirtualDirectoryHandle> = [];
      const entries = await readAllEntries(dirEntry.createReader());

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.isFile) {
          const file = await entryToFile(entry as FSFileEntry);
          if (file) {
            children.push(createFileHandle(file));
          }
        } else if (entry.isDirectory) {
          children.push(createEntryDirectoryHandle(entry as FSDirectoryEntry));
        }

        if ((i + 1) % YIELD_EVERY === 0) {
          await yieldToMainThread();
        }
      }

      return children;
    })();

    return cachedChildrenPromise;
  };

  return {
    kind: "directory",
    name: dirEntry.name,
    async *values() {
      const children = await loadChildren();
      for (const child of children) {
        yield child;
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

export async function buildFromFileListAsync(
  files: FileList,
): Promise<VirtualDirectoryHandle | null> {
  console.log("[buildFromFileListAsync] Starting with", files.length, "files");

  if (files.length === 0) return null;

  const firstFile = files[0] as FileWithPath;
  const firstPath = firstFile.webkitRelativePath || firstFile.name;
  const rootName = firstPath.split("/")[0];
  const root = createDirectoryHandle(rootName, new Map());

  for (let i = 0; i < files.length; i++) {
    const file = files[i] as FileWithPath;
    const relativePath = file.webkitRelativePath || file.name;
    const parts = relativePath.split("/");

    let current = root;
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

    if ((i + 1) % YIELD_EVERY === 0) {
      await yieldToMainThread();
    }
  }

  console.log(
    "[buildFromFileListAsync] Built root with",
    root._children.size,
    "children",
  );
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
  return createEntryDirectoryHandle(entry as FSDirectoryEntry);
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
  return createEntryDirectoryHandle(entry as unknown as FSDirectoryEntry);
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

    input.addEventListener("change", async () => {
      console.log("[showFolderPicker] Change event fired");
      
      const files = input.files;
      input.remove();

      if (!files || files.length === 0) {
        console.log("[showFolderPicker] No files selected");
        resolve(null);
        return;
      }

      console.log(`[showFolderPicker] Got ${files.length} files`);
      const handle = await buildFromFileListAsync(files);
      console.log("[showFolderPicker] Built handle:", handle);
      resolve(handle);
    });

    // Note: Removed the focus-based cancel detection as it interferes with
    // browser confirmation dialogs ("Upload X files?")
    
    input.click();
  });
}
