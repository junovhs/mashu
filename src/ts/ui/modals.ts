import { appState, elements } from "../state.js";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH_RATIO = 0.55;
const VISIBLE_STATS_DEFAULT_RATIO = 0.375;
const HIDDEN_STATS_DEFAULT_RATIO = 0.4;
const SIDEBAR_RATIO_STORAGE_KEY = "sidebarRatio";

function isStatsPanelVisible(): boolean {
  const rightStatsPanel = document.getElementById("rightStatsPanel");
  if (!rightStatsPanel) return false;
  return document.defaultView?.getComputedStyle(rightStatsPanel).display !== "none";
}

function getAvailableContentWidth(): number {
  const appContainer = document.getElementById("appContainer");
  const sidebarResizer = elements.sidebarResizer as HTMLElement | undefined;
  const rightStatsPanel = document.getElementById("rightStatsPanel");

  const containerWidth = appContainer?.clientWidth ?? window.innerWidth;
  const resizerWidth = sidebarResizer?.offsetWidth ?? 0;
  const rightWidth =
    isStatsPanelVisible() && rightStatsPanel
      ? rightStatsPanel.getBoundingClientRect().width
      : 0;

  return Math.max(containerWidth - resizerWidth - rightWidth, MIN_SIDEBAR_WIDTH * 2);
}

function clampSidebarRatio(ratio: number): number {
  const availableWidth = getAvailableContentWidth();
  const minRatio = MIN_SIDEBAR_WIDTH / availableWidth;
  return Math.min(Math.max(ratio, minRatio), MAX_SIDEBAR_WIDTH_RATIO);
}

function getDefaultSidebarRatio(): number {
  return isStatsPanelVisible()
    ? VISIBLE_STATS_DEFAULT_RATIO
    : HIDDEN_STATS_DEFAULT_RATIO;
}

function readSavedSidebarRatio(): number | null {
  const savedRatio = localStorage.getItem(SIDEBAR_RATIO_STORAGE_KEY);
  if (!savedRatio) return null;

  const parsed = Number.parseFloat(savedRatio);
  if (!Number.isFinite(parsed)) return null;

  return clampSidebarRatio(parsed);
}

export function initSidebarResizer(): void {
  const leftSidebar = elements.leftSidebar;
  const sidebarResizer = elements.sidebarResizer;
  const appContainer = document.getElementById("appContainer");
  if (!leftSidebar || !sidebarResizer) return;

  const clampSidebarWidth = (width: number): number => {
    const maxWidth = Math.floor(getAvailableContentWidth() * MAX_SIDEBAR_WIDTH_RATIO);
    return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), maxWidth);
  };

  const applySidebarRatio = (ratio: number, persist = false): void => {
    const availableWidth = getAvailableContentWidth();
    const clampedRatio = clampSidebarRatio(ratio);
    const nextWidth = clampSidebarWidth(Math.round(availableWidth * clampedRatio));
    appContainer?.style.setProperty("--left-sidebar-width", `${nextWidth}px`);
    leftSidebar.style.width = "";
    leftSidebar.style.flexBasis = "";

    if (persist) {
      localStorage.setItem(SIDEBAR_RATIO_STORAGE_KEY, String(clampedRatio));
    }

    window.dispatchEvent(new CustomEvent("sidebarResized"));
  };

  const applyPreferredSidebarRatio = (): void => {
    const preferredRatio = readSavedSidebarRatio() ?? getDefaultSidebarRatio();
    applySidebarRatio(preferredRatio, false);
  };

  applyPreferredSidebarRatio();

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
      const clampedWidth = clampSidebarWidth(nextWidth);
      appContainer?.style.setProperty("--left-sidebar-width", `${clampedWidth}px`);
    };

    const stopResizing = () => {
      sidebarResizer.classList.remove("resizing");
      document.body.classList.remove("sidebar-is-resizing");
      const finalWidth = Math.round(leftSidebar.getBoundingClientRect().width);
      const finalRatio = finalWidth / getAvailableContentWidth();
      applySidebarRatio(finalRatio, true);
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
    applyPreferredSidebarRatio();
  });

  window.addEventListener("sidebarResized", () => {
    appState.viewerInstance?.refresh();
  });
}
