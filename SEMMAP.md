# project -- Semantic Map

**Purpose:** Desktop/web app for selecting files from a codebase, browsing the tree, and collapsing the chosen project contents into a single text export that can be uploaded to chat AI tools that cannot access the local filesystem.

## Legend

`[ENTRY]` Application entry point

`[CORE]` Core business logic

`[TYPE]` Data structures and types

`[UTIL]` Utility functions

`[HOTSPOT]` High fan-in file imported by 4+ others - request this file early in any task

`[GLOBAL-UTIL]` High fan-in utility imported from 3+ distinct domains

`[DOMAIN-CONTRACT]` Shared contract imported mostly by one subsystem

`[ROLE:model]` Primary domain model or state-holding data structure.

`[ROLE:controller]` Coordinates commands, events, or request handling.

`[ROLE:rendering]` Produces visual output or drawing behavior.

`[ROLE:view]` Represents a reusable UI view or presentation component.

`[ROLE:dialog]` Implements dialog-oriented interaction flow.

`[ROLE:config]` Defines configuration loading or configuration schema behavior.

`[ROLE:os-integration]` Bridges the application to OS-specific APIs or services.

`[ROLE:utility]` Provides cross-cutting helper logic without owning core flow.

`[ROLE:bootstrap]` Initializes the application or wires subsystem startup.

`[ROLE:build-only]` Supports the build toolchain rather than runtime behavior.

`[COUPLING:pure]` Logic stays within the language/runtime without external surface coupling.

`[COUPLING:mixed]` Blends pure logic with side effects or boundary interactions.

`[COUPLING:ui-coupled]` Depends directly on UI framework, rendering, or windowing APIs.

`[COUPLING:os-coupled]` Depends directly on operating-system services or platform APIs.

`[COUPLING:build-only]` Only relevant during build, generation, or compilation steps.

`[BEHAVIOR:owns-state]` Maintains durable in-memory state for a subsystem.

`[BEHAVIOR:mutates]` Changes application or model state in response to work.

`[BEHAVIOR:renders]` Produces rendered output, drawing commands, or visual layout.

`[BEHAVIOR:dispatches]` Routes commands, events, or control flow to other units.

`[BEHAVIOR:observes]` Listens to callbacks, notifications, or external signals.

`[BEHAVIOR:persists]` Reads from or writes to durable storage.

`[BEHAVIOR:spawns-worker]` Creates background workers, threads, or async jobs.

`[BEHAVIOR:sync-primitives]` Coordinates execution with locks, channels, or wait primitives.

`[SURFACE:filesystem]` Touches filesystem paths, files, or directory traversal.

`[SURFACE:ntfs]` Uses NTFS-specific filesystem semantics or metadata.

`[SURFACE:win32]` Touches Win32 platform APIs or Windows-native handles.

`[SURFACE:shell]` Integrates with shell commands, shell UX, or command launch surfaces.

`[SURFACE:clipboard]` Reads from or writes to the system clipboard.

`[SURFACE:gdi]` Uses GDI drawing primitives or related graphics APIs.

`[SURFACE:control]` Represents or manipulates widget/control surfaces.

`[SURFACE:view]` Represents a view-level presentation surface.

`[SURFACE:dialog]` Represents a dialog/window interaction surface.

`[SURFACE:document]` Represents document-oriented editing or display surfaces.

`[SURFACE:frame]` Represents application frame/window chrome surfaces.

`[BEHAVIOR:async]` Uses async/await patterns for concurrent execution.

`[BEHAVIOR:panics-on-error]` Contains unwrap/expect/panic patterns that abort on failure.

`[BEHAVIOR:logs-and-continues]` Logs errors and continues without propagating or aborting.

`[BEHAVIOR:returns-nil-on-error]` Returns nil/null/None on error instead of propagating.

`[BEHAVIOR:swallows-errors]` Catches errors without re-raising or propagating them.

`[BEHAVIOR:propagates-errors]` Propagates errors to callers via Result, throw, or raise.

`[SURFACE:http-handler]` Implements HTTP request handling or web endpoint logic.

`[SURFACE:database]` Interacts with database services or ORMs.

`[SURFACE:external-api]` Makes outbound calls to external HTTP APIs or services.

`[SURFACE:template]` Uses template engines for rendering output.

`[QUALITY:undocumented]` Has public symbols without documentation.

`[QUALITY:complex-flow]` Contains functions with high cognitive complexity.

`[QUALITY:error-boundary]` Concentrated error handling — many panic, swallow, or propagation sites.

`[QUALITY:concurrency-heavy]` Uses multiple concurrency primitives (async, locks, spawn).

`[QUALITY:syntax-degraded]` Parse errors detected — semantic analysis may be incomplete.

## Layer 0 -- Config

`README.md`
Project overview and usage guide.

`SEMMAP.md`
Generated semantic map.

`package.json`
Node.js package manifest.

`tsconfig.json`
Configuration for tsconfig.

`vite.config.ts`
Implements vite.config functionality.
Exports: default

## Layer 1 -- Domain (Engine)

`package-lock.json`
Implements package-lock functionality. data.

`public/data/filetypes.json`
Implements filetypes functionality. data.

`public/js/jszip.min.js`
Implements jszip.min functionality. [COUPLING:mixed] [BEHAVIOR:sync-primitives] [QUALITY:complex-flow,concurrency-heavy]
Semantic: synchronized side-effecting

`src/ts/app.ts`
Implements app functionality. [COUPLING:mixed] [BEHAVIOR:owns-state,async,logs-and-continues] [SURFACE:external-api] [QUALITY:complex-flow]
Semantic: async side-effecting stateful module with external API surface that logs and continues

`src/ts/features.ts`
Implements export combined. [COUPLING:mixed] [BEHAVIOR:persists,async]
Exports: downloadZip, exportCombined
Semantic: async side-effecting adapter

`src/ts/filesystem.ts`
Implements scan aggregator. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state,persists,async] [QUALITY:undocumented,complex-flow,concurrency-heavy]
Exports: initTypeData, isLikelyText, sniffIsText, filterScanData
Semantic: async side-effecting stateful adapter

`src/ts/global.d.ts`
Implements global.d functionality.

`src/ts/state.ts`
Defines shared state for the ts subsystem. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state]
Exports: appState, ICONS, elements
Semantic: side-effecting stateful module

`src/ts/ui/layout.ts`
Creates layout. [COUPLING:pure]
Exports: initLayout
Semantic: pure computation

`src/ts/ui/modals.ts`
Creates sidebar resizer. [COUPLING:pure]
Exports: initSidebarResizer
Semantic: pure computation

`src/ts/ui/stats.ts`
Formats global stats for output. [COUPLING:mixed] [BEHAVIOR:owns-state,async] [QUALITY:concurrency-heavy]
Exports: generateTextReportAsync, displayGlobalStats
Semantic: async side-effecting stateful module

`src/ts/ui/tree.ts`
Formats tree for output. [COUPLING:mixed] [BEHAVIOR:owns-state,persists] [QUALITY:undocumented]
Exports: initTreeState, setAllSelections, toggleAllFolders, renderTree
Semantic: side-effecting stateful adapter

`src/ts/ui/viewer.ts`
Updates viewer. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:persists,async,logs-and-continues] [QUALITY:undocumented,concurrency-heavy]
Exports: openFile, closeViewer, updateViewer
Semantic: async side-effecting adapter that logs and continues

## Layer 2 -- Adapters / Infra

`src/ts/utils/crossbrowser_fs.ts`
Cross-Browser File System Abstraction Provides a unified interface using standard web APIs that work in all browsers: - webkitGetAsEntry() for drag & drop - <input webkitdirectory> for folder selection No File System Access API required!. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state,persists,async] [QUALITY:undocumented,concurrency-heavy]
Exports: buildFromFileListAsync, buildFromDropItem, showFolderPicker, VirtualDirectoryHandle
Semantic: async side-effecting stateful adapter

`src/ts/utils/fs_utils.ts`
Formats bytes for output. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state,persists,async] [QUALITY:undocumented]
Exports: initTypeData, isLikelyText, sniffIsText, formatBytes
Semantic: async side-effecting stateful adapter

`src/ts/utils/result.ts`
Implements Err functionality. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state,async] [QUALITY:undocumented]
Exports: toResult, None, Option, Some
Semantic: async side-effecting stateful module

## Layer 3 -- App / Entrypoints

`index.html`
DirAnalyze Streamline v4.0

`src/css/app.css`
Implements app functionality. styles.

`src/css/components.css`
Implements components functionality. styles.

`src/css/dropoverlay.css`
Implements dropoverlay functionality. styles.

`src/css/modals.css`
Implements modals functionality. styles.

`src/css/report.css`
Implements report functionality. styles.

`src/css/stats.css`
Implements stats functionality. styles.

`src/css/tree.css`
Implements tree functionality. styles.

`src/css/viewer.css`
Implements viewer functionality. styles.

`src/ts/types/index.ts`
Implements file type data. [HOTSPOT] [QUALITY:undocumented]
Exports: FileTypeData, AppState, FolderInfo, ScanData

`src/ts/ui/index.ts`
Implements show notification. [HOTSPOT] [COUPLING:mixed] [BEHAVIOR:owns-state,async] [QUALITY:undocumented,concurrency-heavy]
Exports: resetUIForProcessing, copyCurrentReport, refreshAllUI, disableUIControls
Semantic: async side-effecting stateful module


## DependencyGraph

```yaml
DependencyGraph:
  # --- Entrypoints ---
  index.html:
    Imports: [app.ts]
    ImportedBy: []
  # --- High Fan-In Hotspots ---
  crossbrowser_fs.ts:
    Imports: []
    ImportedBy: [app.ts, filesystem.ts, fs_utils.ts, types/index.ts]
  filesystem.ts:
    Imports: [crossbrowser_fs.ts, fs_utils.ts, result.ts, types/index.ts]
    ImportedBy: [app.ts, features.ts, stats.ts, viewer.ts]
  fs_utils.ts:
    Imports: [crossbrowser_fs.ts, result.ts]
    ImportedBy: [app.ts, features.ts, filesystem.ts, stats.ts, tree.ts, viewer.ts]
  state.ts:
    Imports: [types/index.ts]
    ImportedBy: [app.ts, features.ts, modals.ts, stats.ts, tree.ts, ui/index.ts, viewer.ts]
  types/index.ts:
    Imports: [crossbrowser_fs.ts]
    ImportedBy: [app.ts, features.ts, filesystem.ts, state.ts, stats.ts, tree.ts, ui/index.ts, viewer.ts]
  ui/index.ts:
    Imports: [layout.ts, modals.ts, state.ts, stats.ts, tree.ts, types/index.ts, viewer.ts]
    ImportedBy: [app.ts, features.ts, viewer.ts]
  viewer.ts:
    Imports: [filesystem.ts, fs_utils.ts, state.ts, types/index.ts, ui/index.ts]
    ImportedBy: [app.ts, tree.ts, ui/index.ts]
  # --- Layer 0 -- Config ---
  README.md, SEMMAP.md, package.json, tsconfig.json, vite.config.ts:
    Imports: []
    ImportedBy: []
  # --- Layer 1 -- Domain (Engine) ---
  app.ts:
    Imports: [app.css, components.css, crossbrowser_fs.ts, dropoverlay.css, features.ts, filesystem.ts, fs_utils.ts, layout.ts, modals.css, modals.ts, report.css, state.ts, stats.css, tree.css, tree.ts, types/index.ts, ui/index.ts, viewer.css, viewer.ts]
    ImportedBy: [index.html]
  features.ts:
    Imports: [filesystem.ts, fs_utils.ts, state.ts, types/index.ts, ui/index.ts]
    ImportedBy: [app.ts]
  filetypes.json, global.d.ts, jszip.min.js, package-lock.json:
    Imports: []
    ImportedBy: []
  layout.ts:
    Imports: []
    ImportedBy: [app.ts, ui/index.ts]
  modals.ts:
    Imports: [state.ts]
    ImportedBy: [app.ts, ui/index.ts]
  stats.ts:
    Imports: [filesystem.ts, fs_utils.ts, state.ts, types/index.ts]
    ImportedBy: [ui/index.ts]
  tree.ts:
    Imports: [fs_utils.ts, state.ts, types/index.ts, viewer.ts]
    ImportedBy: [app.ts, ui/index.ts]
  # --- Layer 2 -- Adapters / Infra ---
  result.ts:
    Imports: []
    ImportedBy: [filesystem.ts, fs_utils.ts]
  # --- Layer 3 -- App / Entrypoints ---
  app.css, components.css, dropoverlay.css, modals.css, report.css, stats.css, tree.css, viewer.css:
    Imports: []
    ImportedBy: [app.ts]
```
