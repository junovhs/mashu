export function initLayout(): void {
  const leftSidebar = document.getElementById("leftSidebar");
  if (leftSidebar) {
    leftSidebar.innerHTML = `
            <header id="sidebarHeader">
                <img src="/assets/logo.png" alt="DirAnalyze Logo" class="header-logo">
            </header>

            <div id="mainAction">
                <div id="dropZone">
                    <div class="drop-content">
                        <div class="drop-icon">📁</div>
                        <div class="drop-text">DROP FOLDER HERE</div>
                        <div class="drop-alternative">- OR -</div>
                        <button id="selectFolderBtn" class="folder-select-btn">SELECT FOLDER</button>
                    </div>
                </div>
                <div id="loader">ANALYSING...</div>
            </div>

            <hr class="sidebar-hr">

            <div id="treeViewControls">
                <button id="selectAllBtn" class="action-button utility-button" title="Select All Items in Tree"
                    disabled>SELECT ALL</button>
                <button id="deselectAllBtn" class="action-button utility-button" title="Deselect All Items in Tree"
                    disabled>DESELECT ALL</button>
                <button id="commitSelectionsBtn" class="action-button utility-button"
                    title="Commit current selections for report" disabled>COMMIT</button>
                <hr class="sidebar-hr">
                <button id="expandAllBtn" class="action-button utility-button" title="Expand All Folders"
                    disabled>EXPAND ALL</button>
                <button id="collapseAllBtn" class="action-button utility-button" title="Collapse All Folders"
                    disabled>COLLAPSE ALL</button>
            </div>
            <hr class="sidebar-hr">

            <div id="visualOutputContainer" class="content-panel tab-content-item">
                <div class="panel-header">
                    <h2>DIRECTORY TREE</h2>
                </div>
                <div id="treeContainer" class="tree"></div>
            </div>
            <hr class="sidebar-hr">

            <div id="generalActions">
                <button id="aiDebriefingAssistantBtn" class="action-button primary"
                    title="Export the combined text of all committed files" disabled>🚀 EXPORT COMBINED TEXT</button>
                <hr class="sidebar-hr" style="margin-top: 8px; margin-bottom: 8px;">
                <button id="downloadProjectBtn" class="action-button utility-button" disabled
                    title="Download project as ZIP">DOWNLOAD ZIP</button>
                <button id="clearProjectBtn" class="action-button utility-button" disabled
                    title="Clear all project data">CLEAR PROJECT</button>
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
                            <h2>COMPREHENSIVE TEXT REPORT</h2>
                        </div>
                        <pre id="textOutput">// NO PROJECT LOADED //</pre>
                        <div class="button-container"><button id="copyReportButton" class="action-button" disabled>COPY
                                REPORT</button></div>
                    </div>
                </div>
            </div>
            <div id="fileViewer" style="display:none;">
                <div class="viewer-header">
                    <h3 id="viewerFileTitle">FILE VIEWER</h3>
                    <div class="viewer-actions">
                        <button id="closeViewerBtn" class="viewer-button">CLOSE</button>
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
            <div class="panel-header">
                <h2>STATISTICS</h2>
            </div>
            <div id="selectionSummary" class="selection-summary" style="display:none;"></div>
            <div id="globalStats"></div>
            <div class="file-type-stats">
                <h3>FILE TYPE BREAKDOWN</h3>
                <table id="fileTypeTable">
                    <thead>
                        <tr>
                            <th>Extension</th>
                            <th>Count</th>
                            <th>Total Size</th>
                        </tr>
                    </thead>
                    <tbody id="fileTypeTableBody"></tbody>
                </table>
            </div>
        `;
  }
}
