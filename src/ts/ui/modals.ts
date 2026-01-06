import { appState, elements } from "../state.js";
import { getModalHTML } from "./modals_html.js";

export function initModals(): void {
	if (elements.scaffoldImportModal) {
		elements.scaffoldImportModal.innerHTML = getModalHTML();
	}
}

export function openScaffoldModal(): void {
	if (elements.aiScaffoldJsonInput) elements.aiScaffoldJsonInput.value = "";
	if (elements.scaffoldImportModal)
		elements.scaffoldImportModal.style.display = "flex";
}

export function closeScaffoldModal(): void {
	if (elements.scaffoldImportModal)
		elements.scaffoldImportModal.style.display = "none";
}

export function initSidebarResizer(): void {
	const { leftSidebar, sidebarResizer } = elements;
	if (!leftSidebar || !sidebarResizer) return;

	let isResizing = false;
	const savedWidth = localStorage.getItem("sidebarWidth");
	if (savedWidth) leftSidebar.style.width = savedWidth;

	sidebarResizer.addEventListener("mousedown", (e: MouseEvent) => {
		isResizing = true;
		const startX = e.clientX;
		const startWidth = parseInt(
			document.defaultView?.getComputedStyle(leftSidebar).width || "0",
			10,
		);

		const handleMouseMove = (em: MouseEvent) => {
			if (!isResizing) return;
			const newWidth = startWidth + em.clientX - startX;
			leftSidebar.style.width = `${newWidth}px`;
		};

		const handleMouseUp = () => {
			if (!isResizing) return;
			isResizing = false;
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			localStorage.setItem("sidebarWidth", leftSidebar.style.width);
			window.dispatchEvent(new CustomEvent("sidebarResized"));
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	});

	window.addEventListener("sidebarResized", () => {
		// biome-ignore lint/suspicious/noExplicitAny: CodeMirror instance
		(appState.viewerInstance as any)?.refresh();
	});
}
