export function initLayout(): void {
  // Add full-page drop overlay
  const dropOverlay = document.createElement("div");
  dropOverlay.id = "fullPageDropOverlay";
  dropOverlay.innerHTML = `
    <div class="drop-overlay-content">
      <div class="drop-overlay-icon">📂</div>
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
                <span class="logo-name">DirAnalyze</span>
            </header>

            <div id="mainAction">
                <div id="dropZone">
                    <div class="drop-content">
                        <div class="drop-icon">📁</div>
                        <div class="drop-text">Drop a folder to analyze</div>
                        <div class="drop-alternative">or</div>
                        <button id="selectFolderBtn" class="action-button folder-select-btn">Browse files</button>
                    </div>
                </div>
                <div id="loader">Scanning…</div>
            </div>

            <div id="extFilterBar" style="display:none;">
                <div id="extPills" class="ext-pills"></div>
            </div>

            <div id="treeViewControls">
                <div class="tree-ctrl-grid">
                    <button id="selectAllBtn" class="action-button utility-button" title="Select All" disabled>Select all</button>
                    <button id="deselectAllBtn" class="action-button utility-button" title="Deselect All" disabled>Deselect all</button>
                    <button id="expandAllBtn" class="action-button utility-button" title="Expand All" disabled>Expand all</button>
                    <button id="collapseAllBtn" class="action-button utility-button" title="Collapse All" disabled>Collapse all</button>
                </div>
                <button id="commitSelectionsBtn" class="action-button utility-button" title="Commit selections" disabled>Commit selection</button>
            </div>

            <div id="visualOutputContainer" style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
                <div id="treeContainer" class="tree"></div>
            </div>

            <div id="generalActions">
                <button id="aiDebriefingAssistantBtn" class="action-button primary"
                    title="Export the combined text of all committed files" disabled>Export combined text</button>
                <hr class="sidebar-hr" style="margin-top: 8px; margin-bottom: 8px;">
                <div class="utility-action-row">
                    <button id="downloadProjectBtn" class="action-button utility-button" disabled
                        title="Download project as ZIP">Download ZIP</button>
                    <button id="clearProjectBtn" class="action-button utility-button" disabled
                        title="Clear all project data">Clear project</button>
                </div>
            </div>
        `;
  }

  const mainView = document.getElementById("mainView");
  if (mainView) {
    mainView.innerHTML = `
            <nav id="mainViewTabs">
                <button class="tab-button active" data-tab="textReportTab" title="View Comprehensive Text Report">Text
                    Report</button>
            </nav>
            <div id="tabContentArea">
                <div id="textReportTab" class="tab-content-item active">
                    <div id="textOutputContainerOuter" class="content-panel">
                        <div class="panel-header">
                            <h2>Text report</h2>
                        </div>
                        <pre id="textOutput">// No project loaded //</pre>
                        <div class="button-container"><button id="copyReportButton" class="action-button" disabled>Copy report</button></div>
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
