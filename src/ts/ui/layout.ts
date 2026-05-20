export function initLayout(): void {
  // Add full-page drop overlay
  const dropOverlay = document.createElement("div");
  dropOverlay.id = "fullPageDropOverlay";
  dropOverlay.innerHTML = `
    <div class="drop-overlay-content">
      <div class="drop-overlay-icon">DIR</div>
      <h2 class="drop-overlay-title pretext-flow" data-pretext>Drop your folder here</h2>
      <p class="drop-overlay-subtitle pretext-flow" data-pretext>Release to analyze immediately</p>
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
                <span class="logo-name pretext-flow" data-pretext>Mashu</span>
            </header>

            <section class="product-intro">
                <p class="product-intro-eyebrow pretext-flow" data-pretext>Local project reader</p>
                <p class="product-intro-copy pretext-flow" data-pretext>Mashu scans a folder in your browser and turns the files you care about into clean, usable plain text.</p>
                <p class="product-intro-note pretext-flow" data-pretext>Load a folder, review the tree, and narrow the view as you go.</p>
            </section>

            <div id="mainAction">
                <div id="dropZone">
                        <div class="drop-content">
                        <div class="drop-icon">DIR</div>
                        <div class="drop-text pretext-flow" data-pretext>Drop a folder to map the project</div>
                        <div class="drop-subtext pretext-flow" data-pretext>Mashu builds a local tree, live stats, and a plain-text report.</div>
                        <div class="drop-alternative pretext-flow" data-pretext>or</div>
                        <button id="selectFolderBtn" class="action-button folder-select-btn pretext-flow" data-pretext title="Browse for a folder and analyze it locally">Browse for folder</button>
                        <p class="drop-help pretext-flow" data-pretext>Everything stays local to your browser. There is no upload step.</p>
                    </div>
                </div>
                <div id="loader" class="pretext-flow" data-pretext>Scanning...</div>
            </div>

            <div id="extFilterBar" style="display:none;">
                <div class="inline-help">
                    <span class="inline-help-label pretext-flow" data-pretext>Quick select</span>
                    <span class="inline-help-copy pretext-flow" data-pretext>Toggle a file type to select every matching file in the tree.</span>
                </div>
                <div id="extPills" class="ext-pills"></div>
            </div>

            <div id="treeViewControls">
                <p class="control-help pretext-flow" data-pretext>Selections define your working set. As soon as you select files or folders, the report, stats, and export actions focus on that subset.</p>
                <div class="tree-ctrl-grid">
                    <button id="selectAllBtn" class="action-button utility-button pretext-flow" data-pretext title="Select every visible file and folder in the tree" disabled>Select all</button>
                    <button id="deselectAllBtn" class="action-button utility-button pretext-flow" data-pretext title="Clear the current working set" disabled>Deselect all</button>
                    <button id="expandAllBtn" class="action-button utility-button pretext-flow" data-pretext title="Open every folder in the tree" disabled>Expand all</button>
                    <button id="collapseAllBtn" class="action-button utility-button pretext-flow" data-pretext title="Close every folder in the tree" disabled>Collapse all</button>
                </div>
            </div>

            <div id="visualOutputContainer" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
                <div id="treeContainer" class="tree"></div>
            </div>

            <div id="generalActions">
                <p class="control-help control-help--compact pretext-flow" data-pretext>Export combined text from the current view, or download the full scanned folder as a ZIP at any time.</p>
                <button id="aiDebriefingAssistantBtn" class="action-button primary pretext-flow" data-pretext
                    title="Download one text file containing every text file in the current view" disabled>Export combined text</button>
                <hr class="sidebar-hr" style="margin-top: 8px; margin-bottom: 8px;">
                <div class="utility-action-row">
                    <button id="downloadProjectBtn" class="action-button utility-button pretext-flow" data-pretext disabled
                        title="Download the full scanned project as a ZIP">Download ZIP</button>
                    <button id="clearProjectBtn" class="action-button utility-button pretext-flow" data-pretext disabled
                        title="Remove the current scan and start over">Clear project</button>
                </div>
            </div>
        `;
  }

  const mainView = document.getElementById("mainView");
  if (mainView) {
    mainView.innerHTML = `
            <nav id="mainViewTabs">
                <button class="tab-button active pretext-flow" data-pretext data-tab="textReportTab" title="View the current folder or selection as plain text">Text report</button>
            </nav>
            <div id="tabContentArea">
                <div id="textReportTab" class="tab-content-item active">
                    <div id="textOutputContainerOuter" class="content-panel">
                        <div class="panel-header">
                            <h2 class="pretext-flow" data-pretext>Text report</h2>
                        </div>
                        <div class="panel-copy">
                            <p class="pretext-flow" data-pretext>A readable project map for the current view.</p>
                        </div>
                        <div id="textOutput" class="report-placeholder">
                            <div class="report-placeholder-copy pretext-flow" data-pretext data-pretext-white-space="pre-wrap">// Load a folder to start. //
// Mashu scans locally in your browser and shows a tree, stats, and a plain-text report. //
// Select files or folders to instantly focus copy/export actions on a smaller subset. //</div>
                        </div>
                        <div class="button-container">
                            <p class="panel-help pretext-flow" data-pretext>Copy the current plain-text report or save it as a .txt file.</p>
                            <div class="utility-action-row report-action-row">
                                <button id="copyReportButton" class="action-button pretext-flow" data-pretext title="Copy the current text report to the clipboard" disabled>Copy to clipboard</button>
                                <button id="saveReportButton" class="action-button utility-button pretext-flow" data-pretext title="Save the current text report as a text file" disabled>Save as .txt</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="fileViewer" style="display:none;">
                <div class="viewer-header">
                    <h3 id="viewerFileTitle" class="pretext-flow" data-pretext>File viewer</h3>
                    <div class="viewer-actions">
                        <button id="closeViewerBtn" class="viewer-button pretext-flow" data-pretext>Close</button>
                    </div>
                </div>
                <div class="viewer-container">
                    <div id="viewerContent" style="height:100%; width:100%;"></div>
                </div>
                <div class="viewer-footer"><span id="viewerInfo" class="pretext-flow" data-pretext></span></div>
            </div>
        `;
  }

  const rightStatsPanel = document.getElementById("rightStatsPanel");
  if (rightStatsPanel) {
    rightStatsPanel.innerHTML = `
            <p class="stats-panel-title pretext-flow" data-pretext>Statistics</p>
            <p class="stats-panel-intro pretext-flow" data-pretext>Counts always reflect the current view. Select a subset and this panel narrows immediately.</p>
            <div id="selectionSummary" class="selection-summary" style="display:none;"></div>
            <div id="globalStats"></div>
            <p class="stats-section-label pretext-flow" data-pretext>File Type Breakdown</p>
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
