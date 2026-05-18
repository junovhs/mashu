import { appState, elements } from "../state.js";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH_RATIO = 0.55;

export function initSidebarResizer(): void {
  const leftSidebar = elements.leftSidebar;
  const sidebarResizer = elements.sidebarResizer;
  if (!leftSidebar || !sidebarResizer) return;

  const savedWidth = localStorage.getItem("sidebarWidth");
  if (savedWidth) leftSidebar.style.width = savedWidth;

  const clampSidebarWidth = (width: number): number => {
    const maxWidth = Math.floor(window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO);
    return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), maxWidth);
  };

  const persistSidebarWidth = (width: number): void => {
    leftSidebar.style.width = `${clampSidebarWidth(width)}px`;
    localStorage.setItem("sidebarWidth", leftSidebar.style.width);
    window.dispatchEvent(new CustomEvent("sidebarResized"));
  };

  sidebarResizer.addEventListener("pointerdown", (event: PointerEvent) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = parseInt(
      document.defaultView?.getComputedStyle(leftSidebar).width || "0",
      10,
    );

    sidebarResizer.classList.add("resizing");
    document.body.classList.add("sidebar-is-resizing");
    sidebarResizer.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      leftSidebar.style.width = `${clampSidebarWidth(nextWidth)}px`;
    };

    const stopResizing = () => {
      sidebarResizer.classList.remove("resizing");
      document.body.classList.remove("sidebar-is-resizing");
      persistSidebarWidth(parseInt(leftSidebar.style.width || `${startWidth}`, 10));
      sidebarResizer.removeEventListener("pointermove", handlePointerMove);
      sidebarResizer.removeEventListener("pointerup", handlePointerUp);
      sidebarResizer.removeEventListener("pointercancel", handlePointerCancel);
    };

    const handlePointerUp = () => {
      stopResizing();
    };

    const handlePointerCancel = () => {
      stopResizing();
    };

    sidebarResizer.addEventListener("pointermove", handlePointerMove);
    sidebarResizer.addEventListener("pointerup", handlePointerUp);
    sidebarResizer.addEventListener("pointercancel", handlePointerCancel);
  });

  window.addEventListener("resize", () => {
    const currentWidth = parseInt(
      document.defaultView?.getComputedStyle(leftSidebar).width || "0",
      10,
    );
    persistSidebarWidth(currentWidth);
  });

  window.addEventListener("sidebarResized", () => {
    appState.viewerInstance?.refresh();
  });
}
