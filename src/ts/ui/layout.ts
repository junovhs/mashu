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
          <span class="brand-name">MashuPack</span>
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
            <span class="ext-filter-label">Select by type</span>
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
            <span class="tree-shortcuts-hint" aria-label="Tree shortcuts" data-tooltip="☑  Click checkbox — include in export&#10;▶  Click folder — expand / collapse&#10;⇧/Alt+click — expand / collapse subtree&#10;/  key — focus search filter"></span>
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
              <p class="empty-state-sub">Modern AI tools don't just read uploads — they navigate them. MashuPack exports your project as a structured, file-addressable artifact that AI tools can grep, search, and explore like a real codebase.</p>
            </div>

            <div id="mainAction" class="empty-state-drop-wrap">
              <div id="dropZone" data-help="No upload — MashuPack reads your folder through browser file APIs. Nothing is sent to any server. Files are only read when you preview or export.">
                <div class="dz-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="dz-title">Drop a folder here</div>
                <div class="dz-sub">or drag individual files — MashuPack groups them by folder.</div>
                <div class="dz-or">OR</div>
                <button id="selectFolderBtn" class="dz-browse" data-help="Open your file browser to select a folder. MashuPack scans it locally — nothing is uploaded.">Browse for folder</button>
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
// MashuPack scans locally in your browser and shows a tree, stats, and a plain-text report.
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
      </footer>
    `;
  }

  // Full-screen docs overlay
  const docsOverlay = document.createElement("div");
  docsOverlay.id = "docsOverlay";
  docsOverlay.setAttribute("aria-modal", "true");
  docsOverlay.setAttribute("role", "dialog");
  docsOverlay.setAttribute("aria-label", "Documentation");
  docsOverlay.innerHTML = `
    <nav class="docs-topbar">
      <button id="docsBackBtn" class="docs-back-btn" aria-label="Back to app">← Back to app</button>
      <span class="docs-topbar-brand">MashuPack</span>
      <span class="docs-topbar-sep">/</span>
      <span class="docs-topbar-page">Documentation</span>
    </nav>
    <div class="docs-layout">
      <aside class="docs-sidebar">
        <div class="docs-sidebar-label">On this page</div>
        <ul class="docs-sidebar-nav">
          <li><a href="#ds-overview">Overview</a></li>
          <li><a href="#ds-privacy">Privacy</a></li>
          <li><a href="#ds-loading">Loading a project</a></li>
          <li><a href="#ds-tree">Browsing the tree</a></li>
          <li><a href="#ds-selecting">Selecting files</a></li>
          <li><a href="#ds-stats">Stats &amp; token toggle</a></li>
          <li><a href="#ds-exporting">Exporting</a></li>
          <li><a href="#ds-viewer">File viewer</a></li>
          <li><a href="#ds-format">Export format</a></li>
          <li><a href="#ds-large">Large repos</a></li>
          <li><a href="#ds-ai">Using with AI tools</a></li>
          <li><a href="#ds-tech">How it's built</a></li>
        </ul>
      </aside>
      <main class="docs-main">
        <header class="ds-header">
          <h1 class="ds-title">How MashuPack works</h1>
          <p class="ds-lead">Everything you need to know about what MashuPack does, how your files are handled, and what to do with the output.</p>
        </header>

        <section class="ds" id="ds-overview">
          <h2>Overview</h2>
          <p>MashuPack packages a local codebase into a single structured text file that AI tools can navigate like a real project.</p>
          <p>The common objection: <em>"stuffing a whole repo into an AI ruins its attention."</em> That's true for naive copy-paste dumps. But modern AI tools like Claude and ChatGPT have internal environments — they can execute code, grep, search, and navigate structured text the same way a developer would in a terminal. When the export has clear file path headers and explicit boundaries, the AI doesn't have to read everything at once. It finds what it needs, reads that file, traces imports, and moves on.</p>
          <p>Everything runs in your browser. Nothing is uploaded to any server.</p>
        </section>

        <section class="ds" id="ds-privacy">
          <h2>Privacy</h2>
          <p>MashuPack reads your files through your browser's built-in File System Access API. When you drop a folder, your browser gives MashuPack read access to that folder. File contents are read only when you preview or export — everything else (tree, stats, file names, sizes) comes from filesystem metadata. No data is uploaded to any server. There is no MashuPack server for it to go to.</p>
          <div class="ds-callout">If you export and upload to an AI tool, that upload is governed by that tool's privacy policy. MashuPack's job ends when the file lands on your disk.</div>
        </section>

        <section class="ds" id="ds-loading">
          <h2>Loading a project</h2>
          <p>Two ways to load a folder: <strong>drag and drop</strong> a folder anywhere on the app, or click <strong>Browse for folder</strong> to use the native picker. MashuPack scans the folder and builds the file tree.</p>
          <p>To start fresh, click <strong>Clear project</strong> in the top bar.</p>
        </section>

        <section class="ds" id="ds-tree">
          <h2>Browsing the tree</h2>
          <p>Click a folder row to expand or collapse it. Click a filename to preview it in the File viewer. Use the search bar to filter by name — press <code>/</code> to focus it. <strong>Shift+click</strong> or <strong>Alt+click</strong> a folder to expand or collapse its entire subtree. Use the <strong>Expand all / Collapse all</strong> buttons to open or close every folder at once.</p>
          <p>The left panel is resizable — drag the handle on its right edge to adjust its width.</p>
        </section>

        <section class="ds" id="ds-selecting">
          <h2>Selecting files</h2>
          <p>Tick any file or folder checkbox to scope your export. Ticking a folder selects everything inside it. Use <strong>Select All / Deselect All</strong>, or the <strong>file-type pills</strong> to toggle all files of a given extension at once. The right-panel file types table does the same — click any row to toggle that type.</p>
          <p>When a selection is active, a <code>SELECTION</code> pill appears in the stats header and all exports operate on your selection only. Deselect all to return to full-project mode.</p>
        </section>

        <section class="ds" id="ds-stats">
          <h2>Stats &amp; the token toggle</h2>
          <p>The right panel shows live stats: Files, Folders, Size, and Root folder name. <strong>Click the Size stat to toggle between bytes and estimated token count</strong> (~4 chars/token, consistent with GPT and Claude tokenizers for typical code). Use this to check whether your export will fit in a model's context window before downloading. The size column in the file types table also switches when you toggle.</p>
          <p>The <strong>Composition bar</strong> shows each file type's share of total project size. Hover a segment for the exact type and percentage. Below it, the <strong>File types table</strong> lists every extension with count and size — click a row to select or deselect all files of that type.</p>
        </section>

        <section class="ds" id="ds-exporting">
          <h2>Exporting</h2>
          <ol>
            <li><strong>Export combined text</strong> — downloads a single structured <code>.txt</code> with all in-scope files and a directory tree header. This is the main output for AI tools.</li>
            <li><strong>Download .zip</strong> — downloads the full project as a ZIP archive, regardless of selection.</li>
            <li><strong>Copy to clipboard</strong> — copies the text report directly. Paste into an AI chat without saving a file.</li>
            <li><strong>Save as .txt</strong> — saves the text report. Same content as Export combined text, triggered from within the report panel.</li>
          </ol>
          <p>The bottom status bar always shows how many files and bytes are currently in scope.</p>
        </section>

        <section class="ds" id="ds-viewer">
          <h2>File viewer</h2>
          <p>Click any file in the tree to preview it in the <strong>File viewer</strong> tab with syntax highlighting (powered by CodeMirror). Viewing a file does <em>not</em> include it in your export — inclusion is controlled only by checkboxes in the tree.</p>
          <p>Switch between <strong>Text report</strong> and <strong>File viewer</strong> using the tabs above the main panel.</p>
        </section>

        <section class="ds" id="ds-format">
          <h2>Export format</h2>
          <p>The exported file is plain text. It starts with a directory tree of the exported project, then each file wrapped in explicit START/END markers with its full path:</p>
          <pre class="ds-pre">// ===== START OF FILE: src/app.ts ===== //
import { something } from "./lib";
...
// ===== END OF FILE: src/app.ts ===== //


// ===== START OF FILE: src/lib.ts ===== //
export function something() { ... }
// ===== END OF FILE: src/lib.ts ===== //</pre>
          <p>The START/END markers are what allow AI tools to grep, search, and navigate the export as a virtual project. Without them, the model sees one undifferentiated blob. With them, it can locate a specific file, read it, trace what it imports, and move on — the same way you would in a terminal.</p>
        </section>

        <section class="ds" id="ds-large">
          <h2>Large repos</h2>
          <p>For most projects, MashuPack feels instant. For very large repositories — tens of thousands of files — the initial scan can take 10–20 seconds. This is browser filesystem enumeration and cannot be sped up on MashuPack's end. Once the scan completes, browsing, selecting, and exporting are fast regardless of project size.</p>
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

        <section class="ds" id="ds-ai">
          <h2>Using with AI tools</h2>
          <p>Upload a MashuPack export to Claude or ChatGPT and the model can treat it as a virtual project — finding a function, tracing a dependency, reading a specific file — without loading every byte into its attention window at once. The path headers are what make navigation reliable.</p>
          <p>No guarantees: this depends on the AI provider and the tool you're using. But with current Claude and ChatGPT file analysis capabilities, a well-structured MashuPack export is often more useful than pasting individual files — because the model can see the whole project layout and search for what it needs.</p>
          <div class="ds-callout">Check the token count before exporting. Click the Size stat to toggle from bytes to estimated tokens, then compare against your tool's context limit.</div>
        </section>

        <section class="ds" id="ds-tech">
          <h2>How it's built</h2>
          <p>MashuPack is a static browser app — no server, no backend. It deploys as plain files on GitHub Pages and runs entirely client-side.</p>
          <p>The indexing and selection math runs in <strong>Rust compiled to WebAssembly</strong>. Doing that on the browser's main thread would block rendering. Rust/WASM behind a Web Worker keeps all of that compute off the main thread and genuinely fast, even at the scale of the Kubernetes repository.</p>
          <ul>
            <li><strong>Rust + WebAssembly</strong> — tree construction, selection state, index math. Compiled with <code>wasm-pack</code>, runs in a Web Worker.</li>
            <li><strong>TypeScript</strong> — all UI logic, event handling, filesystem coordination, export assembly.</li>
            <li><strong>Vite</strong> — build tooling and dev server, with <code>vite-plugin-wasm</code> for clean WASM imports.</li>
            <li><strong>File System Access API</strong> — lets MashuPack read local folders without uploading them. Real directory handles, lazy file reading.</li>
            <li><strong>Virtualized tree rendering</strong> — only visible rows are in the DOM. Scrolling through 28,000 files stays smooth.</li>
            <li><strong>CodeMirror</strong> — syntax-highlighted file preview in the File viewer tab.</li>
          </ul>
        </section>

      </main>
    </div>
  `;
  document.body.appendChild(docsOverlay);

  // Mobile fallback — shown via CSS below 640px
  const mobileFallback = document.createElement("div");
  mobileFallback.id = "mobileFallback";
  mobileFallback.innerHTML = `
    <div class="mobile-fallback-content">
      <div class="mobile-fallback-brand">MashuPack</div>
      <h1 class="mobile-fallback-title">Designed for desktop browsers</h1>
      <p class="mobile-fallback-body">To analyze a local codebase, open this page on a laptop or desktop browser and drag in a project folder.</p>
      <div class="mobile-fallback-actions">
        <a href="/docs.html" class="mobile-fallback-btn">Read docs</a>
        <a href="https://github.com/junovhs/mashu" class="mobile-fallback-btn mobile-fallback-btn--ghost" rel="noopener noreferrer" target="_blank">View GitHub</a>
      </div>
    </div>
  `;
  document.body.appendChild(mobileFallback);

  const docsToggle = document.getElementById("docsToggleBtn");
  const docsBack = document.getElementById("docsBackBtn");
  const openDocs = () => { docsOverlay.classList.add("open"); docsOverlay.scrollTop = 0; };
  const closeDocs = () => docsOverlay.classList.remove("open");
  docsToggle?.addEventListener("click", openDocs);
  docsBack?.addEventListener("click", closeDocs);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && docsOverlay.classList.contains("open")) closeDocs();
  });

  // Sidebar active link tracking
  const docsSections = docsOverlay.querySelectorAll<HTMLElement>(".ds[id]");
  const sidebarLinks = docsOverlay.querySelectorAll<HTMLAnchorElement>(".docs-sidebar-nav a");
  const sidebarObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sidebarLinks.forEach(a => a.classList.remove("active"));
        const active = docsOverlay.querySelector<HTMLAnchorElement>(`.docs-sidebar-nav a[href="#${entry.target.id}"]`);
        if (active) active.classList.add("active");
      }
    });
  }, { root: docsOverlay, rootMargin: "-15% 0px -75% 0px", threshold: 0 });
  docsSections.forEach(s => sidebarObs.observe(s));

  // Sidebar link smooth scroll within overlay
  sidebarLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = docsOverlay.querySelector(link.getAttribute("href") ?? "");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
