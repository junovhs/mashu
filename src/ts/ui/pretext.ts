import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
  setLocale,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";

type PretextBinding = {
  element: HTMLElement;
  sourceText: string;
  lastWidth: number;
  preparedKey: string | null;
  prepared: PreparedTextWithSegments | null;
};

const bindings = new Map<HTMLElement, PretextBinding>();
const preparedCache = new Map<string, PreparedTextWithSegments>();
const dirtyElements = new Set<HTMLElement>();

let resizeObserver: ResizeObserver | null = null;
let flushId = 0;
let initialized = false;

export function initPretextText(): void {
  if (initialized) return;
  initialized = true;

  if (typeof navigator !== "undefined" && navigator.language) {
    setLocale(navigator.language);
  }

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target;
        if (!(element instanceof HTMLElement)) return;

        const binding = bindings.get(element);
        if (!binding) return;

        const nextWidth = Math.floor(entry.contentRect.width);
        if (nextWidth <= 0 || nextWidth === binding.lastWidth) return;

        binding.lastWidth = nextWidth;
        queueRender(element);
      });
    });
  }

  window.addEventListener("resize", queueAllRenders);
  window.addEventListener("sidebarResized", queueAllRenders);
  syncPretextTree(document);
}

export function syncPretextTree(root: ParentNode = document): void {
  ensureInitialized();

  root.querySelectorAll<HTMLElement>("[data-pretext]").forEach((element) => {
    bindElement(element);
    queueRender(element);
  });

  cleanupDisconnectedBindings();
}

export function setPretextText(element: HTMLElement, text: string): void {
  ensureInitialized();
  element.dataset.pretextSource = text;
  bindElement(element);

  const binding = bindings.get(element);
  if (!binding) return;

  binding.sourceText = text;
  queueRender(element);
}

function bindElement(element: HTMLElement): void {
  const existing = bindings.get(element);
  const sourceText = element.dataset.pretextSource ?? element.textContent ?? "";

  if (existing) {
    if (sourceText.length > 0) {
      existing.sourceText = sourceText;
    }
    if (resizeObserver) {
      resizeObserver.observe(element);
    }
    return;
  }

  bindings.set(element, {
    element,
    sourceText,
    lastWidth: 0,
    preparedKey: null,
    prepared: null,
  });

  if (resizeObserver) {
    resizeObserver.observe(element);
  }
}

function queueAllRenders(): void {
  bindings.forEach((binding) => {
    queueRender(binding.element);
  });
}

function queueRender(element: HTMLElement): void {
  dirtyElements.add(element);
  if (flushId !== 0) return;

  flushId = window.requestAnimationFrame(() => {
    flushId = 0;
    flushRenders();
  });
}

function flushRenders(): void {
  cleanupDisconnectedBindings();

  Array.from(dirtyElements).forEach((element) => {
    dirtyElements.delete(element);
    renderBinding(element);
  });
}

function renderBinding(element: HTMLElement): void {
  const binding = bindings.get(element);
  if (!binding) return;

  const styles = window.getComputedStyle(element);
  const lineHeight = readLineHeight(styles);
  const prepareOptions = getPrepareOptions(element, styles);
  const font = getCanvasFont(styles);
  const prepared = getPreparedText(binding, font, prepareOptions);
  const widthMode = element.dataset.pretextWidthMode;
  const width =
    widthMode === "natural"
      ? Math.ceil(Math.max(measureNaturalWidth(prepared), 1))
      : getRenderableWidth(element);
  if (width <= 0) return;

  if (widthMode === "natural") {
    element.style.width = `${width}px`;
    element.style.maxWidth = "none";
  } else {
    element.style.removeProperty("width");
    element.style.removeProperty("max-width");
  }

  const result = layoutWithLines(prepared, width, lineHeight);
  const renderedText = result.lines.map((line) => line.text).join("\n");

  if (element.textContent !== renderedText) {
    element.textContent = renderedText;
  }

  element.style.whiteSpace = "pre-wrap";
  element.dataset.pretextSource = binding.sourceText;
  element.dataset.pretextReady = "true";
}

function getRenderableWidth(element: HTMLElement): number {
  const ownWidth = Math.floor(element.clientWidth);
  if (ownWidth > 0) {
    return ownWidth;
  }

  let current = element.parentElement;
  while (current) {
    const candidateWidth = Math.floor(current.clientWidth);
    if (candidateWidth > 0) {
      const styles = window.getComputedStyle(current);
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft || "0") +
        Number.parseFloat(styles.paddingRight || "0");
      return Math.max(1, Math.floor(candidateWidth - horizontalPadding));
    }
    current = current.parentElement;
  }

  return 0;
}

function getPreparedText(
  binding: PretextBinding,
  font: string,
  options: PrepareOptions,
): PreparedTextWithSegments {
  const key = [
    binding.sourceText,
    font,
    options.whiteSpace ?? "normal",
    options.wordBreak ?? "normal",
    options.letterSpacing ?? 0,
  ].join("\u001f");

  if (binding.preparedKey === key && binding.prepared) {
    return binding.prepared;
  }

  const cached = preparedCache.get(key);
  if (cached) {
    binding.preparedKey = key;
    binding.prepared = cached;
    return cached;
  }

  const prepared = prepareWithSegments(binding.sourceText, font, options);
  preparedCache.set(key, prepared);
  binding.preparedKey = key;
  binding.prepared = prepared;
  return prepared;
}

function getPrepareOptions(
  element: HTMLElement,
  styles: CSSStyleDeclaration,
): PrepareOptions {
  const dataWhiteSpace = element.dataset.pretextWhiteSpace;
  const whiteSpace =
    dataWhiteSpace === "pre-wrap" || styles.whiteSpace.includes("pre-wrap")
      ? "pre-wrap"
      : "normal";

  return {
    whiteSpace,
    wordBreak: styles.wordBreak === "keep-all" ? "keep-all" : "normal",
    letterSpacing: readLetterSpacing(styles),
  };
}

function getCanvasFont(styles: CSSStyleDeclaration): string {
  const parts = [
    styles.fontStyle,
    styles.fontVariant,
    styles.fontWeight,
    styles.fontStretch,
    styles.fontSize,
    styles.fontFamily,
  ].filter((part) => part && part !== "normal");

  if (parts.length === 0) {
    return `${styles.fontSize} ${styles.fontFamily}`;
  }

  return parts.join(" ");
}

function readLineHeight(styles: CSSStyleDeclaration): number {
  const direct = Number.parseFloat(styles.lineHeight);
  if (Number.isFinite(direct)) return direct;

  const fontSize = Number.parseFloat(styles.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.2 : 16;
}

function readLetterSpacing(styles: CSSStyleDeclaration): number {
  const letterSpacing = Number.parseFloat(styles.letterSpacing);
  return Number.isFinite(letterSpacing) ? letterSpacing : 0;
}

function cleanupDisconnectedBindings(): void {
  bindings.forEach((_, element) => {
    if (element.isConnected) return;

    if (resizeObserver) {
      resizeObserver.unobserve(element);
    }

    bindings.delete(element);
    dirtyElements.delete(element);
  });
}

function ensureInitialized(): void {
  if (!initialized) {
    initPretextText();
  }
}