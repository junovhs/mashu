export function initLayout(): void {
  // Full-page drop overlay (same behavior, restyled)
  const dropOverlay = document.createElement("div");
  dropOverlay.id = "fullPageDropOverlay";
  dropOverlay.innerHTML = `
    <div class="drop-overlay-content">
      <div class="drop-overlay-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="drop-overlay-title">Drop your folder here</h2>
      <p class="drop-overlay-subtitle">Release to analyze immediately — everything stays in your browser.</p>
    </div>
  `;
  document.body.appendChild(dropOverlay);

  // App shell. Grid: topBar / [leftSidebar | resizer | mainView | rightStatsPanel] / bottomBar
  const appContainer = document.getElementById("appContainer");
  if (appContainer) {
    appContainer.innerHTML = `
      <header id="topBar">
        <div class="brand">
          <span class="brand-name">Mashu</span>
          <button id="docsToggleBtn" class="brand-docs-link" type="button" data-help="Open documentation — your current project stays loaded.">Docs</button>
        </div>
        <div class="scope" id="topScope">
          <div class="scope-path" id="scopePath">
            <span class="scope-empty">NO PROJECT LOADED</span>
          </div>
          <div class="scope-meta" id="scopeMeta"></div>
        </div>
        <div class="top-actions">
          <button id="clearProjectBtn" class="btn ghost" data-help="Remove the current scan and start fresh." disabled>Clear project</button>
          <button id="downloadProjectBtn" class="btn" data-help="Download the full project as a ZIP archive. This ignores your current selection." disabled>Download .zip</button>
          <button id="aiDebriefingAssistantBtn" class="btn primary" data-help="Export selected files as one structured text file. If nothing is selected, the full project is exported." disabled>Export combined text</button>
        </div>
      </header>

      <aside id="leftSidebar">
        <div class="side-head">
          <h2 class="side-title">Tree</h2>
          <span id="sideSelected" class="side-selected"></span>
        </div>

        <div id="emptyTreeIntro" class="side-intro">
          <p>Once you load a folder, the tree appears here. Click a file to preview it. Tick files or folders to include them in your export.</p>
        </div>

        <div id="treeSearchBar" class="tree-search">
          <label class="tree-search-input-wrap" for="treeSearchInput">
            <input id="treeSearchInput" class="tree-search-input" placeholder="Filter by name..." type="text" autocomplete="off" spellcheck="false" data-help="Filter the tree by filename. Press / to focus." />
            <span class="tree-search-kbd" aria-hidden="true">/</span>
          </label>
        </div>

        <div id="extFilterBar" style="display:none;">
          <div class="ext-filter-head">
            <span class="ext-filter-label">File types</span>
          </div>
          <div id="extPills" class="ext-pills"></div>
        </div>

        <div id="treeViewControls" class="tree-controls">
          <div class="tree-ctrl-row">
            <button id="selectAllBtn" class="ctrl-btn ctrl-btn--select" data-help="Select every file and folder — your export will include the full project." disabled>Select all</button>
            <button id="deselectAllBtn" class="ctrl-btn ctrl-btn--clear" data-help="Clear your selection and return to full-project mode." disabled>Deselect all</button>
            <span class="ctrl-divider" aria-hidden="true"></span>
            <button id="expandAllBtn" class="ctrl-btn ctrl-btn--expand" data-help="Expand every folder so all files are visible in the tree." disabled>Expand</button>
            <button id="collapseAllBtn" class="ctrl-btn ctrl-btn--collapse" data-help="Collapse all folders to show only top-level items." disabled>Collapse</button>
            <span class="tree-hint" data-help="Shift or Alt-click any folder to expand or collapse its entire subtree at once." aria-label="Shift or Alt-click a folder to expand or collapse its entire subtree.">⇧/Alt+click: subtree</span>
          </div>
        </div>

        <div id="visualOutputContainer">
          <div id="treeContainer" class="tree"></div>
        </div>
      </aside>

      <div id="sidebarResizer" aria-hidden="true" data-help="Drag to resize the file tree panel."></div>

      <main id="mainView">
        <div id="emptyStateView">
          <section class="empty-state-hero">
            <div class="empty-state-copy">
              <h1 class="empty-state-title">
                Turn any folder into <span class="empty-state-title-accent">readable</span> text.
              </h1>
              <p class="empty-state-sub">Modern AI tools don't just read uploads — they navigate them. Mashu exports your project as a structured, file-addressable artifact that AI tools can grep, search, and explore like a real codebase.</p>
            </div>

            <div id="mainAction" class="empty-state-drop-wrap">
              <div id="dropZone" data-help="No upload — Mashu reads your folder through browser file APIs. Nothing is sent to any server. Files are only read when you preview or export.">
                <div class="dz-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="dz-title">Drop a folder here</div>
                <div class="dz-sub">… or any file selection — Mashu figures out the shape.</div>
                <div class="dz-or">OR</div>
                <button id="selectFolderBtn" class="dz-browse" data-help="Open your file browser to select a folder. Mashu scans it locally — nothing is uploaded.">Browse for folder</button>
                <p class="dz-privacy">Everything stays in your browser</p>
              </div>
              <div id="loader" class="loader">Scanning…</div>
            </div>

          </section>
        </div>

        <nav id="mainViewTabs">
          <button class="tab-button active" data-tab="textReportTab" data-help="The combined text output of your project or selection — ready to copy or export.">Text report</button>
          <button class="tab-button" data-tab="fileViewerTab" data-help="Preview any file's contents. Viewing a file does not include it in your export.">File viewer</button>
        </nav>
        <div id="tabContentArea">
          <div id="textReportTab" class="tab-content-item active">
            <div id="textOutputContainerOuter" class="content-panel">
              <div class="panel-header">
                <h1 id="reportTitle">Project map</h1>
                <p id="reportDescription" class="panel-sub">Plain-text map of everything in scope. Ready to copy or save.</p>
              </div>
              <div id="textOutput" class="report-placeholder">
                <div class="report-placeholder-copy">// Load a folder to start.
// Mashu scans locally in your browser and shows a tree, stats, and a plain-text report.
// Select files or folders to instantly focus copy/export actions on a smaller subset.</div>
              </div>
            </div>
          </div>
          <div id="fileViewerTab" class="tab-content-item">
            <div id="fileViewer">
              <div class="viewer-header">
                <h3 id="viewerFileTitle">File viewer</h3>
                <div class="viewer-actions">
                  <button id="closeViewerBtn" class="viewer-button" data-help="Close the file preview and return to the text report.">Close</button>
                </div>
              </div>
              <div class="viewer-container">
                <div id="viewerContent" style="height:100%; width:100%;"></div>
              </div>
              <div class="viewer-footer"><span id="viewerInfo">Select a file in the tree to preview it here.</span></div>
            </div>
          </div>
        </div>
      </main>

      <aside id="rightStatsPanel">
        <div class="stat-head">
          <h2 data-help="File counts, sizes, and type breakdown for your loaded project.">Info</h2>
          <span id="statScopePill" class="scope-pill" style="display:none;" data-help="Stats and exports reflect your selection only. Deselect all to return to full-project view.">SELECTION</span>
        </div>
        <div id="emptyStatsIntro" class="stat-empty-copy">
          <p>Stats appear here after you load a folder — file counts, size, composition by type, depth profile.</p>
        </div>
        <div id="selectionSummary" class="selection-summary" style="display:none;"></div>
        <div id="globalStats"></div>
        <div class="stat-section">
          <div class="stat-section-head">
            <h3 class="stat-section-title">Composition</h3>
            <span class="stat-section-meta" data-help="Each segment shows a file type's share of total project size in bytes.">BY SIZE</span>
          </div>
          <div id="compositionBar" class="comp-bar" data-help="Each color represents a file type's share of total project size. Hover a segment for details."></div>
          <div id="compositionLegend" class="comp-legend"></div>
        </div>
        <div class="stat-section">
          <h3 class="stat-section-title" data-help="Breakdown of every file type in the project — count and total size.">File types</h3>
          <table id="fileTypeTable">
            <thead>
              <tr>
                <th>Type</th>
                <th>Files</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody id="fileTypeTableBody"></tbody>
          </table>
        </div>
      </aside>

      <footer id="bottomBar">
        <div class="bar-info" id="barInfo">
          <span>Awaiting a folder…</span>
        </div>
        <div class="bar-spacer" id="helpZone">
          <span id="helpZoneText" class="help-zone-text"></span>
        </div>
        <button id="emptyChooseFolderBtn" class="btn primary" data-help="Open a folder from your computer to get started.">Choose a folder</button>
      </footer>
    `;
  }

  // Docs overlay — injected outside appContainer so it covers everything
  const docsOverlay = document.createElement("div");
  docsOverlay.id = "docsOverlay";
  docsOverlay.setAttribute("aria-modal", "true");
  docsOverlay.setAttribute("role", "dialog");
  docsOverlay.setAttribute("aria-label", "Documentation");
  docsOverlay.innerHTML = `
    <div class="docs-sheet">
      <div class="docs-sheet-head">
        <span class="docs-sheet-title">Documentation</span>
        <button id="docsCloseBtn" class="docs-close" aria-label="Close documentation">✕</button>
      </div>
      <div class="docs-sheet-body">

        <section class="ds">
          <h2>What Mashu does</h2>
          <p>Mashu packages a local codebase into a single structured text file that AI tools can navigate like a real project.</p>
          <p>The common objection: <em>"stuffing a whole repo into an AI ruins its attention."</em> That's true for naive copy-paste dumps. But modern AI tools like Claude and ChatGPT have internal environments — they can execute code, grep, search, and navigate structured text the same way a developer would in a terminal. When the export has clear file path headers and explicit boundaries, the AI doesn't have to read everything at once. It finds what it needs, reads that file, traces imports, and moves on.</p>
          <p>Mashu's job is to make that export as clean and navigable as possible: select the right files, package them with structured headers, and give the AI something it can actually work with — not a wall of text.</p>
          <p>Everything runs in your browser. Nothing is uploaded to any server.</p>
        </section>

        <section class="ds">
          <h2>Your files stay in your browser</h2>
          <p>Mashu reads your files through your browser's built-in file APIs. When you drop a folder, your browser gives Mashu read access to that folder. Mashu builds the file tree, calculates stats, and holds everything in memory. No data is uploaded to any server. There is no Mashu server for it to go to.</p>
          <p>File contents are read only when you actually need them — when you preview a file, or when you export. Everything else (the tree, stats, file names, sizes) comes from filesystem metadata, which is much lighter.</p>
          <div class="ds-callout">If you export a combined text file and upload it to an AI tool, that upload is governed by that tool's privacy policy. Mashu's job ends when the file lands on your disk.</div>
        </section>

        <section class="ds">
          <h2>How to use it</h2>
          <ol>
            <li><strong>Drop a folder</strong> onto the app, or use the folder picker. Mashu scans the folder and builds a tree.</li>
            <li><strong>Browse the tree.</strong> Filter by name using the search bar, or click a file to preview it.</li>
            <li><strong>Select what matters.</strong> Tick files or folders to scope your export. Use the file-type pills to select all files of a given type at once. Leave everything unticked to export the full project.</li>
            <li><strong>Export.</strong> Click "Export combined text" to download a single structured text file of your selection.</li>
          </ol>
          <p>"Download .zip" downloads the entire project as a ZIP archive regardless of selection — it is separate from the text export.</p>
        </section>

        <section class="ds">
          <h2>What the export looks like</h2>
          <p>The exported file is plain text. Each file starts with a clearly marked path header, followed by its contents, separated by a divider. The format is intentionally machine-readable — not just human-readable.</p>
          <p>The path headers are what allow an AI's internal tools to grep, search, and navigate the export as a virtual project. Without them, the model sees one undifferentiated blob. With them, it can find <code>src/auth/session.ts</code>, read it, trace what it imports, and move on — the same way you would in a terminal.</p>
        </section>

        <section class="ds">
          <h2>Large folders and scan time</h2>
          <p>For most projects, Mashu feels instant. For very large repositories — tens of thousands of files — the initial scan can take 10–20 seconds. This time is browser filesystem enumeration: your browser has to read metadata for every file before Mashu can build the tree. This is a browser-level operation.</p>
          <p>Once the scan completes, browsing, selecting, and exporting are fast regardless of project size.</p>
          <table class="ds-table">
            <thead><tr><th>Step</th><th>Time</th></tr></thead>
            <tbody>
              <tr><td>Filesystem scan (28,481 files)</td><td>13.3s</td></tr>
              <tr><td>Tree initialization</td><td>16ms</td></tr>
              <tr><td>Tree render</td><td>7ms</td></tr>
              <tr><td>Visible load total</td><td>~20.9s</td></tr>
            </tbody>
          </table>
          <p class="ds-note">Tested with <code>kubernetes/kubernetes</code> on a desktop browser. No backend. No upload.</p>
        </section>

        <section class="ds">
          <h2>Using the export with AI tools</h2>
          <p>The obvious objection: <em>"stuffing a whole repo into an AI's context ruins its attention — the model can't reason over thousands of files."</em></p>
          <p>That objection is correct for naive prompt dumps. But it misses how modern AI systems actually work.</p>
          <p>Tools like ChatGPT and Claude don't just read uploaded files as raw context. They have internal environments where they can execute code, grep, search, and navigate structured text the same way a developer would in a terminal. When you upload a Mashu export, the model can treat it as a virtual project — finding a function, tracing a dependency, or reading a specific file — without loading every byte into its attention window at once.</p>
          <p>This is why the export format uses clear path headers and explicit file boundaries. The AI isn't reading the export like a wall of text. It's navigating it like a filesystem — and the headers are what make that navigation reliable.</p>
          <p>No guarantees: this depends on the AI provider and the tool you're using. But with current Claude and ChatGPT file analysis capabilities, a well-structured Mashu export of a real codebase is often more useful than pasting individual files — because the model can see the whole project layout and search for what it needs.</p>
          <div class="ds-callout">A few things that still help: select only the files relevant to your question, use file-type pills to skip assets and lock files, and check the file size before exporting — very large exports may behave differently depending on the tool.</div>
        </section>

        <section class="ds">
          <h2>How it's built</h2>
          <p>Mashu is a static browser app — no server, no backend. It deploys as plain files on GitHub Pages and runs entirely client-side.</p>
          <p>The part I'm most proud of: the indexing and selection math runs in <strong>Rust compiled to WebAssembly</strong>.</p>
          <p>When you load a large project, there's real computation involved — building a tree from tens of thousands of file entries, calculating selection state, tracking included files, computing stats. Doing that on the browser's main thread would block rendering. Rust/WASM behind a Web Worker keeps all of that compute off the main thread and genuinely fast, even at the scale of the Kubernetes repository.</p>
          <ul>
            <li><strong>Rust + WebAssembly</strong> — tree construction, selection state, index math. Compiled with <code>wasm-pack</code>, runs in a Web Worker.</li>
            <li><strong>TypeScript</strong> — all UI logic, event handling, filesystem coordination, export assembly.</li>
            <li><strong>Vite</strong> — build tooling and dev server, with <code>vite-plugin-wasm</code> for clean WASM imports.</li>
            <li><strong>File System Access API</strong> — lets Mashu read local folders without uploading them. Real directory handles, lazy file reading.</li>
            <li><strong>Web Workers</strong> — the Rust/WASM engine runs in a Worker, keeping the main thread free for UI.</li>
            <li><strong>Virtualized tree rendering</strong> — only visible rows are in the DOM. Scrolling through 28,000 files stays smooth because the browser isn't rendering 28,000 elements.</li>
            <li><strong>CodeMirror</strong> — syntax-highlighted file preview.</li>
          </ul>
        </section>

      </div>
    </div>
  `;
  document.body.appendChild(docsOverlay);

  const docsToggle = document.getElementById("docsToggleBtn");
  const docsClose = document.getElementById("docsCloseBtn");
  const openDocs = () => docsOverlay.classList.add("open");
  const closeDocs = () => docsOverlay.classList.remove("open");
  docsToggle?.addEventListener("click", openDocs);
  docsClose?.addEventListener("click", closeDocs);
  docsOverlay.addEventListener("click", (e) => {
    if (e.target === docsOverlay) closeDocs();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && docsOverlay.classList.contains("open")) closeDocs();
  });

  const emptyChooseBtn = document.getElementById("emptyChooseFolderBtn");
  if (emptyChooseBtn) {
    emptyChooseBtn.addEventListener("click", () => {
      const selectBtn = document.getElementById("selectFolderBtn") as HTMLButtonElement | null;
      selectBtn?.click();
    });
  }

  // Inject copy/save report buttons
  const reportPanel = document.getElementById("textOutputContainerOuter");
  if (reportPanel && !document.getElementById("copyReportButton")) {
    const actions = document.createElement("div");
    actions.className = "report-actions";
    actions.innerHTML = `
      <button id="copyReportButton" class="btn small" data-help="Copy the current text output to your clipboard." disabled>Copy to clipboard</button>
      <button id="saveReportButton" class="btn small ghost" data-help="Save the current text output as a .txt file." disabled>Save as .txt</button>
    `;
    reportPanel.appendChild(actions);
  }

  initHelpSystem();
}

function initHelpSystem(): void {
  const textEl = document.getElementById("helpZoneText");
  if (!textEl) return;

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const show = (msg: string) => {
    if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
    textEl.textContent = msg;
    textEl.classList.add("visible");
  };

  const hide = () => {
    hideTimer = setTimeout(() => {
      textEl.classList.remove("visible");
      hideTimer = null;
    }, 80);
  };

  document.addEventListener("mouseover", (e) => {
    const target = (e.target as Element).closest("[data-help]") as HTMLElement | null;
    if (target?.dataset.help) show(target.dataset.help);
  });

  document.addEventListener("mouseout", (e) => {
    const from = (e.target as Element).closest("[data-help]");
    const to = (e.relatedTarget as Element | null)?.closest("[data-help]");
    if (from && !to) hide();
  });
}
