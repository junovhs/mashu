export function initLayout(): void {
  // Add full-page drop overlay
  const dropOverlay = document.createElement("div");
  dropOverlay.id = "fullPageDropOverlay";
  dropOverlay.innerHTML = `
    <div class="drop-overlay-content">
      <div class="drop-overlay-icon">DIR</div>
      <h2 class="drop-overlay-title">Drop your folder here</h2>
      <p class="drop-overlay-subtitle">Release to analyze immediately</p>
    </div>
  `;
  document.body.appendChild(dropOverlay);

  const leftSidebar = document.getElementById("leftSidebar");
  if (leftSidebar) {
    leftSidebar.innerHTML = `
            <header id="sidebarHeader">
                <svg class="logo-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5a2 2 0 012-2h3.586a1 1 0 01.707.293L10.707 5H15a2 2 0 012 2v1H3V5z" fill="#F6821F"/>
                  <path d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" fill="#F6821F" opacity="0.7"/>
                  <path d="M7 11h2M7 13.5h4" stroke="#111113" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span class="logo-name">Mashu</span>
            </header>

            <section class="product-intro">
                <p class="product-intro-eyebrow">Local project reader</p>
                <p class="product-intro-copy">Mashu scans a folder in your browser, lets you narrow it to the files that matter, and turns that view into plain text you can read, copy, or hand to an LLM.</p>
                <p class="product-intro-note">Load a folder, review the tree, then commit a smaller working set when you want stats and export actions to focus only on that subset.</p>
            </section>

            <div id="mainAction">
                <div id="dropZone">
                    <div class="drop-content">
                        <div class="drop-icon">DIR</div>
                        <div class="drop-text">Drop a folder to map the project</div>
                        <div class="drop-subtext">Mashu builds a local tree, live stats, and a plain-text report.</div>
                        <div class="drop-alternative">or</div>
                        <button id="selectFolderBtn" class="action-button folder-select-btn" title="Browse for a folder and analyze it locally">Browse for folder</button>
                        <p class="drop-help">Everything stays local to your browser. There is no upload step.</p>
                    </div>
                </div>
                <div id="loader">Scanning...</div>
            </div>

            <div id="extFilterBar" style="display:none;">
                <div class="inline-help">
                    <span class="inline-help-label">Quick select</span>
                    <span class="inline-help-copy">Toggle a file type to select every matching file in the tree.</span>
                </div>
                <div id="extPills" class="ext-pills"></div>
            </div>

            <div id="treeViewControls">
                <p class="control-help">Selections define your working set. Commit the current selection when you want the report, stats, and export actions to use only that subset.</p>
                <div class="tree-ctrl-grid">
                    <button id="selectAllBtn" class="action-button utility-button" title="Select every visible file and folder in the tree" disabled>Select all</button>
                    <button id="deselectAllBtn" class="action-button utility-button" title="Clear the current working set" disabled>Deselect all</button>
                    <button id="expandAllBtn" class="action-button utility-button" title="Open every folder in the tree" disabled>Expand all</button>
                    <button id="collapseAllBtn" class="action-button utility-button" title="Close every folder in the tree" disabled>Collapse all</button>
                </div>
                <button id="commitSelectionsBtn" class="action-button utility-button" title="Use the current selection as the focused subset for stats and export" disabled>Commit selection</button>
            </div>

            <div id="visualOutputContainer" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
                <div id="treeContainer" class="tree"></div>
            </div>

            <div id="generalActions">
                <p class="control-help control-help--compact">Export combined text after you commit a focused subset, or download the full scanned folder as a ZIP at any time.</p>
                <button id="aiDebriefingAssistantBtn" class="action-button primary"
                    title="Download one text file containing every committed text file" disabled>Export combined text</button>
                <hr class="sidebar-hr" style="margin-top: 8px; margin-bottom: 8px;">
                <div class="utility-action-row">
                    <button id="downloadProjectBtn" class="action-button utility-button" disabled
                        title="Download the full scanned project as a ZIP">Download ZIP</button>
                    <button id="clearProjectBtn" class="action-button utility-button" disabled
                        title="Remove the current scan and start over">Clear project</button>
                </div>
            </div>
        `;
  }

  const mainView = document.getElementById("mainView");
  if (mainView) {
    mainView.innerHTML = `
            <nav id="mainViewTabs">
                <button class="tab-button active" data-tab="textReportTab" title="View the current folder or selection as plain text">Text
                    Report</button>
            </nav>
            <div id="tabContentArea">
                <div id="textReportTab" class="tab-content-item active">
                    <div id="textOutputContainerOuter" class="content-panel">
                        <div class="panel-header">
                            <h2>Text report</h2>
                        </div>
                        <div class="panel-copy">
                            <p>This panel turns the current view into a plain-text outline. Before commit it reflects the whole folder; after commit it reflects only the focused subset you selected.</p>
                        </div>
                        <pre id="textOutput">// Load a folder to start. //
// Mashu scans locally in your browser and shows a tree, stats, and a plain-text report. //
// Commit a selection when you want copy/export actions to focus on a smaller subset. //</pre>
                        <div class="button-container">
                            <p class="panel-help">Copy this report when you want a portable snapshot for notes, tickets, or AI prompts.</p>
                            <button id="copyReportButton" class="action-button" title="Copy the current text report to the clipboard" disabled>Copy report</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="fileViewer" style="display:none;">
                <div class="viewer-header">
                    <h3 id="viewerFileTitle">File viewer</h3>
                    <div class="viewer-actions">
                        <button id="closeViewerBtn" class="viewer-button">Close</button>
                    </div>
                </div>
                <div class="viewer-container">
                    <div id="viewerContent" style="height:100%; width:100%;"></div>
                </div>
                <div class="viewer-footer"><span id="viewerInfo"></span></div>
            </div>
        `;
  }

  const rightStatsPanel = document.getElementById("rightStatsPanel");
  if (rightStatsPanel) {
    rightStatsPanel.innerHTML = `
            <p class="stats-panel-title">Statistics</p>
            <p class="stats-panel-intro">Counts always reflect the current view. After you commit a selection, this panel narrows to that focused subset.</p>
            <div id="selectionSummary" class="selection-summary" style="display:none;"></div>
            <div id="globalStats"></div>
            <p class="stats-section-label">File Type Breakdown</p>
            <table id="fileTypeTable">
                <thead>
                    <tr>
                        <th>Ext</th>
                        <th>Count</th>
                        <th>Size</th>
                    </tr>
                </thead>
                <tbody id="fileTypeTableBody"></tbody>
            </table>
        `;
  }
}
