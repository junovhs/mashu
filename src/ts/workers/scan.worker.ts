import type {
  PureFileInfo,
  PureFolderInfo,
  SerializableEntry,
  SerializableFileEntry,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "../types/index.js";
import init, { build_tree_from_entries, compute_selection_state, engine_version, init_tree_index } from "../../../rust-core/pkg/rust_core.js";

// ---------------------------------------------------------------------------
// Rust engine bootstrap — falls back to TS implementation if unavailable.
// ---------------------------------------------------------------------------

let rustEngineVersion: string | null = null;

async function tryInitRustEngine(): Promise<void> {
  try {
    // web target requires explicit init() with the WASM URL.
    // Vite resolves new URL(..., import.meta.url) as a static asset reference.
    const wasmUrl = new URL(
      "../../../rust-core/pkg/rust_core_bg.wasm",
      import.meta.url,
    );
    await init(wasmUrl);
    rustEngineVersion = engine_version();
    console.info(`[worker] rust engine ready v${rustEngineVersion}`);
  } catch {
    console.info("[worker] rust engine not available, using ts fallback");
  }
}

// Initialize on startup; message handlers wait for this if needed.
const engineReady = tryInitRustEngine();

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener("message", (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;

  if (msg.type === "ping") {
    void engineReady.then(() => {
      const reply: WorkerOutboundMessage = { type: "pong" };
      self.postMessage(reply);
    });
    return;
  }

  if (msg.type === "scan-batch") {
    void engineReady.then(() => {
      const tree = rustEngineVersion
        ? buildTreeViaRust(msg.entries)
        : buildPureTree(msg.entries);
      if (tree) {
        const rustIndexReady = rustEngineVersion
          ? init_tree_index(JSON.stringify(msg.entries))
          : false;
        const reply: WorkerOutboundMessage = { type: "stats-ready", batchId: msg.batchId, tree, rustIndexReady };
        self.postMessage(reply);
      } else {
        const reply: WorkerOutboundMessage = { type: "scan-result", batchId: msg.batchId, ok: false };
        self.postMessage(reply);
      }
    });
    return;
  }

  if (msg.type === "compute-selection-state") {
    void engineReady.then(() => {
      const json = compute_selection_state(JSON.stringify(msg.selectedFilePaths));
      if (json) {
        const result = JSON.parse(json) as { selectedSubtreeCounts: Record<string, number>; selectedFolderPaths: string[] };
        const reply: WorkerOutboundMessage = {
          type: "selection-state-ready",
          selectedSubtreeCounts: result.selectedSubtreeCounts,
          selectedFolderPaths: result.selectedFolderPaths,
        };
        self.postMessage(reply);
      }
    });
    return;
  }
});

// ---------------------------------------------------------------------------
// Rust path: delegates tree construction to the WASM engine
// ---------------------------------------------------------------------------

function buildTreeViaRust(entries: SerializableEntry[]): PureFolderInfo | null {
  try {
    const json = build_tree_from_entries(JSON.stringify(entries));
    return json ? (JSON.parse(json) as PureFolderInfo) : null;
  } catch {
    // Fall through to TypeScript implementation on any error.
    return buildPureTree(entries);
  }
}

// ---------------------------------------------------------------------------
// TypeScript fallback: tree construction from flat entries
// ---------------------------------------------------------------------------

function buildPureTree(entries: SerializableEntry[]): PureFolderInfo | null {
  if (entries.length === 0) return null;

  const folderMap = new Map<string, PureFolderInfo>();

  // First pass: create all folder nodes
  for (const e of entries) {
    if (e.kind === "folder") {
      folderMap.set(e.path, {
        type: "folder",
        name: e.name,
        path: e.path,
        depth: e.depth,
        children: [],
        fileCount: 0,
        dirCount: 0,
        totalSize: 0,
        fileTypes: {},
      });
    }
  }

  // Second pass: link children to parents and accumulate leaf stats
  for (const e of entries) {
    const parentPath = e.path.includes("/")
      ? e.path.slice(0, e.path.lastIndexOf("/"))
      : null;

    if (e.kind === "file") {
      const fe = e as SerializableFileEntry;
      const file: PureFileInfo = {
        type: "file",
        name: fe.name,
        path: fe.path,
        size: fe.size,
        extension: fe.extension,
        depth: fe.depth,
      };
      if (parentPath) {
        folderMap.get(parentPath)?.children.push(file);
      }
    } else if (parentPath) {
      const child = folderMap.get(e.path);
      const parent = folderMap.get(parentPath);
      if (child && parent) {
        parent.children.push(child);
      }
    }
  }

  // Third pass: compute stats bottom-up (deepest folders first)
  const sortedFolders = [...folderMap.values()].sort((a, b) => b.depth - a.depth);
  for (const folder of sortedFolders) {
    for (const child of folder.children) {
      if (child.type === "file") {
        folder.fileCount++;
        folder.totalSize += child.size;
        const ft = folder.fileTypes;
        if (!ft[child.extension]) ft[child.extension] = { count: 0, size: 0 };
        ft[child.extension].count++;
        ft[child.extension].size += child.size;
      } else {
        folder.dirCount += 1 + child.dirCount;
        folder.fileCount += child.fileCount;
        folder.totalSize += child.totalSize;
        for (const [ext, data] of Object.entries(child.fileTypes)) {
          const ft = folder.fileTypes;
          if (!ft[ext]) ft[ext] = { count: 0, size: 0 };
          ft[ext].count += data.count;
          ft[ext].size += data.size;
        }
      }
    }
  }

  // Root is the entry at depth 0
  return [...folderMap.values()].find((f) => f.depth === 0) ?? null;
}
