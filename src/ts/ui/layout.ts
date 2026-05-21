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
      <h2 class="drop-overlay-title pretext-flow" data-pretext>Drop your folder here</h2>
      <p class="drop-overlay-subtitle pretext-flow" data-pretext>Release to analyze immediately — everything stays in your browser.</p>
    </div>
  `;
  document.body.appendChild(dropOverlay);

  // App shell. Grid: topBar / [leftSidebar | resizer | mainView | rightStatsPanel] / bottomBar
  const appContainer = document.getElementById("appContainer");
  if (appContainer) {
    appContainer.innerHTML = `
      <header id="topBar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="18" rx="5" fill="currentColor"/>
              <path d="M6 16V9l3 4 3-4v7" stroke="oklch(0.22 0.013 70)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M14 12c0-1.5 1.2-2.5 2.5-2.5S19 10.5 19 12c0 .9-.7 1.5-1.5 2-1 .6-1.5 1-1.5 2h3" stroke="oklch(0.22 0.013 70)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </span>
          <span class="brand-name pretext-flow" data-pretext>Mashu</span>
          <span class="brand-tag pretext-flow" data-pretext>V2 · LOCAL</span>
        </div>
        <div class="scope" id="topScope">
          <div class="scope-path" id="scopePath">
            <span class="scope-empty pretext-flow" data-pretext>NO PROJECT LOADED</span>
          </div>
          <div class="scope-meta" id="scopeMeta"></div>
        </div>
        <div class="top-actions">
          <button id="topOpenBtn" class="top-action pretext-flow" data-pretext title="Browse for a folder">
            <span>Open folder</span>
            <span class="top-action-kbd" aria-hidden="true">⌘O</span>
          </button>
        </div>
      </header>

      <aside id="leftSidebar">
        <div class="side-head">
          <h2 class="side-title pretext-flow" data-pretext>Tree</h2>
          <span id="sideSelected" class="side-selected"></span>
        </div>

        <div id="emptyTreeIntro" class="side-intro">
          <p class="pretext-flow" data-pretext>Once you load a folder, the tree appears here. Click a file to view it, tick a folder to scope the report.</p>
        </div>

        <div id="treeSearchBar" class="tree-search">
          <label class="tree-search-input-wrap" for="treeSearchInput">
            <input id="treeSearchInput" class="tree-search-input pretext-flow" data-pretext placeholder="Filter by name..." type="text" autocomplete="off" spellcheck="false" />
            <span class="tree-search-kbd" aria-hidden="true">/</span>
          </label>
        </div>

        <div id="extFilterBar" style="display:none;">
          <div id="extPills" class="ext-pills"></div>
        </div>

        <div id="treeViewControls" class="tree-controls">
          <div class="tree-ctrl-row">
            <button id="selectAllBtn" class="ctrl-btn pretext-flow" data-pretext title="Select every visible file and folder" disabled>Select all</button>
            <button id="deselectAllBtn" class="ctrl-btn pretext-flow" data-pretext title="Clear the current working set" disabled>Deselect</button>
            <span class="ctrl-divider" aria-hidden="true"></span>
            <button id="expandAllBtn" class="ctrl-btn pretext-flow" data-pretext title="Open every folder" disabled>Expand</button>
            <button id="collapseAllBtn" class="ctrl-btn pretext-flow" data-pretext title="Close every folder" disabled>Collapse</button>
          </div>
        </div>

        <div id="visualOutputContainer">
          <div id="treeContainer" class="tree"></div>
        </div>
      </aside>

      <div id="sidebarResizer" aria-hidden="true"></div>

      <main id="mainView">
        <div id="emptyStateView">
          <section class="empty-state-hero">
            <div class="empty-state-copy">
              <h1 class="empty-state-title">
                Turn any folder into <span class="empty-state-title-accent">readable</span> text.
              </h1>
              <p class="empty-state-sub pretext-flow" data-pretext>Drop a project folder to map its tree, see what's actually in it, and export the parts you care about as one combined text file.</p>
            </div>

            <div id="mainAction" class="empty-state-drop-wrap">
              <div id="dropZone">
                <div class="dz-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="dz-title pretext-flow" data-pretext>Drop a folder here</div>
                <div class="dz-sub pretext-flow" data-pretext>… or any file selection — Mashu figures out the shape.</div>
                <div class="dz-or pretext-flow" data-pretext>OR</div>
                <button id="selectFolderBtn" class="dz-browse pretext-flow" data-pretext title="Browse for a folder and analyze it locally">Browse for folder</button>
                <p class="dz-privacy pretext-flow" data-pretext>Everything stays in your browser</p>
              </div>
              <div id="loader" class="loader pretext-flow" data-pretext>Scanning…</div>
            </div>

            <section id="recentProjects" class="recent-projects" aria-labelledby="recentProjectsTitle">
              <h2 id="recentProjectsTitle" class="recent-projects-title pretext-flow" data-pretext>Recent</h2>
              <div id="recentProjectsList" class="recent-projects-list"></div>
            </section>
          </section>
        </div>

        <nav id="mainViewTabs">
          <button class="tab-button active pretext-flow" data-pretext data-tab="textReportTab" title="View the current folder or selection as plain text">Text report</button>
          <button class="tab-button pretext-flow" data-pretext data-tab="fileViewerTab" title="Preview the selected file">File viewer</button>
        </nav>
        <div id="tabContentArea">
          <div id="textReportTab" class="tab-content-item active">
            <div id="textOutputContainerOuter" class="content-panel">
              <div class="panel-header">
                <h1 id="reportTitle" class="pretext-flow" data-pretext>Project map</h1>
                <p id="reportDescription" class="panel-sub pretext-flow" data-pretext>Plain-text map of everything in scope. Ready to copy or save.</p>
              </div>
              <div id="textOutput" class="report-placeholder">
                <div class="report-placeholder-copy pretext-flow" data-pretext data-pretext-white-space="pre-wrap">// Load a folder to start.
// Mashu scans locally in your browser and shows a tree, stats, and a plain-text report.
// Select files or folders to instantly focus copy/export actions on a smaller subset.</div>
              </div>
            </div>
          </div>
          <div id="fileViewerTab" class="tab-content-item">
            <div id="fileViewer">
              <div class="viewer-header">
                <h3 id="viewerFileTitle" class="pretext-flow" data-pretext>File viewer</h3>
                <div class="viewer-actions">
                  <button id="closeViewerBtn" class="viewer-button pretext-flow" data-pretext>Close</button>
                </div>
              </div>
              <div class="viewer-container">
                <div id="viewerContent" style="height:100%; width:100%;"></div>
              </div>
              <div class="viewer-footer"><span id="viewerInfo" class="pretext-flow" data-pretext>Select a file in the tree to preview it here.</span></div>
            </div>
          </div>
        </div>
      </main>

      <aside id="rightStatsPanel">
        <div class="stat-head">
          <h2 class="pretext-flow" data-pretext>Project</h2>
          <span id="statScopePill" class="scope-pill" style="display:none;">SELECTION</span>
        </div>
        <div id="emptyStatsIntro" class="stat-empty-copy">
          <p class="pretext-flow" data-pretext>Stats appear here after you load a folder — file counts, size, composition by type, depth profile.</p>
        </div>
        <div id="selectionSummary" class="selection-summary" style="display:none;"></div>
        <div id="globalStats"></div>
        <div class="stat-section">
          <div class="stat-section-head">
            <h3 class="stat-section-title pretext-flow" data-pretext>Composition</h3>
            <span class="stat-section-meta pretext-flow" data-pretext>BY SIZE</span>
          </div>
          <div id="compositionBar" class="comp-bar"></div>
          <div id="compositionLegend" class="comp-legend"></div>
        </div>
        <div class="stat-section">
          <h3 class="stat-section-title pretext-flow" data-pretext>File types</h3>
          <table id="fileTypeTable">
            <thead>
              <tr>
                <th class="pretext-flow" data-pretext>Type</th>
                <th class="pretext-flow" data-pretext>Files</th>
                <th class="pretext-flow" data-pretext>Size</th>
              </tr>
            </thead>
            <tbody id="fileTypeTableBody"></tbody>
          </table>
        </div>
      </aside>

      <footer id="bottomBar">
        <div class="bar-info" id="barInfo">
          <span class="pretext-flow" data-pretext>Awaiting a folder…</span>
        </div>
        <div class="bar-spacer"></div>
        <button id="emptyChooseFolderBtn" class="btn primary pretext-flow" data-pretext title="Browse for a folder and analyze it locally">Choose a folder</button>
        <button id="clearProjectBtn" class="btn ghost pretext-flow" data-pretext title="Remove the current scan and start over" disabled>Clear project</button>
        <button id="downloadProjectBtn" class="btn pretext-flow" data-pretext title="Download the full scanned project as a ZIP" disabled>Download .zip</button>
        <button id="aiDebriefingAssistantBtn" class="btn primary pretext-flow" data-pretext title="Download one text file containing every text file in the current view" disabled>Export combined text</button>
      </footer>
    `;
  }

  // Wire the topOpenBtn to also call the folder-select flow (same behavior as #selectFolderBtn).
  const topOpenBtn = document.getElementById("topOpenBtn");
  if (topOpenBtn) {
    topOpenBtn.addEventListener("click", () => {
      const selectBtn = document.getElementById("selectFolderBtn") as HTMLButtonElement | null;
      selectBtn?.click();
    });
  }

  const emptyChooseBtn = document.getElementById("emptyChooseFolderBtn");
  if (emptyChooseBtn) {
    emptyChooseBtn.addEventListener("click", () => {
      const selectBtn = document.getElementById("selectFolderBtn") as HTMLButtonElement | null;
      selectBtn?.click();
    });
  }

  // Wire copy/save report buttons into the text report panel (they live in the bottom bar in this layout).
  // They get attached via app.ts setupListeners using ids #copyReportButton/#saveReportButton — inject them now.
  const reportPanel = document.getElementById("textOutputContainerOuter");
  if (reportPanel && !document.getElementById("copyReportButton")) {
    const actions = document.createElement("div");
    actions.className = "report-actions";
    actions.innerHTML = `
      <button id="copyReportButton" class="btn small pretext-flow" data-pretext title="Copy the current text report to the clipboard" disabled>Copy to clipboard</button>
      <button id="saveReportButton" class="btn small ghost pretext-flow" data-pretext title="Save the current text report as a text file" disabled>Save as .txt</button>
    `;
    reportPanel.appendChild(actions);
  }
}
