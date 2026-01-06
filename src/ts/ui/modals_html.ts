export function getModalHTML() {
	return `
        <div class="diff-modal-content">
            <div>
                <h3>Import AI-Generated Project Scaffold</h3>
                <span class="diff-modal-close" id="closeScaffoldModalBtn">×</span>
            </div>
             <div class="modal-scrollable-content">
                <p style="font-size:0.9em; color:var(--dim-color); margin-top:0;">Paste the full JSON object from your AI below. It must include 'structureString' and 'fileContents'.</p>
                <textarea id="aiScaffoldJsonInput" rows="10" placeholder='{ "structureString": "myApp(...)", "fileContents": [...] }'></textarea>
            </div>
            <div class="diff-modal-actions">
                <button id="createProjectFromScaffoldBtn" class="action-button primary">Create Project on Disk</button>
                <button id="cancelScaffoldImportBtn" class="action-button secondary">Cancel</button>
            </div>
        </div>
    `;
}
