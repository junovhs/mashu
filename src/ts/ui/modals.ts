import { appState, elements } from "../state.js";
import { getModalHTML } from "./modals_html.js";

export function initModals(): void {
  // FIX: Use document.getElementById directly.
  // The 'elements' registry is not populated yet when this runs.
  const modal = document.getElementById("scaffoldImportModal");
  if (modal) {
    modal.innerHTML = getModalHTML();
  }
}

export function openScaffoldModal(): void {
  const input = elements.aiScaffoldJsonInput as HTMLTextAreaElement | undefined;
  if (input) input.value = "";
  const modal = elements.scaffoldImportModal;
  if (modal) modal.style.display = "flex";
}

export function closeScaffoldModal(): void {
  const modal = elements.scaffoldImportModal;
  if (modal) modal.style.display = "none";
}

export function initSidebarResizer(): void {
  const leftSidebar = elements.leftSidebar;
  const sidebarResizer = elements.sidebarResizer;
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
    appState.viewerInstance?.refresh();
  });
}
