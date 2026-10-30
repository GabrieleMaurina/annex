const MEDIA = new Set(['img', 'svg', 'canvas', 'video', 'iframe']);
const SIDES = ['top', 'right', 'bottom', 'left'];
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [tabindex], [contenteditable]';

function hasColor(color: string): boolean {
  return color !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(color);
}

function paints(element: Element, style: CSSStyleDeclaration): boolean {
  if (style.visibility === 'hidden' || style.opacity === '0') return false;
  return (
    MEDIA.has(element.localName) ||
    hasColor(style.backgroundColor) ||
    style.backgroundImage !== 'none' ||
    style.boxShadow !== 'none' ||
    SIDES.some(
      (side) =>
        parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
        hasColor(style.getPropertyValue(`border-${side}-color`)),
    )
  );
}

function coversViewport(rect: DOMRect): boolean {
  return (
    rect.left <= 0 &&
    rect.top <= 0 &&
    rect.right >= window.innerWidth &&
    rect.bottom >= window.innerHeight
  );
}

function onScreen(rect: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function overText(element: Element, x: number, y: number): boolean {
  const range = document.createRange();
  return Array.from(element.childNodes).some((node) => {
    if (!(node instanceof Text) || !node.textContent?.trim()) return false;
    range.selectNodeContents(node);
    return Array.from(range.getClientRects()).some((rect) =>
      contains(rect, x, y),
    );
  });
}

export function isBackground(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
): boolean {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) {
    return false;
  }
  const backgroundCursors = [
    'auto',
    'default',
    getComputedStyle(document.documentElement).cursor,
  ];
  if (!backgroundCursors.includes(getComputedStyle(target).cursor)) {
    return false;
  }
  const { clientX: x, clientY: y } = event;
  return (
    document
      .elementsFromPoint(x, y)
      .every(
        (element) =>
          element === document.body ||
          element === document.documentElement ||
          (!paints(element, getComputedStyle(element)) &&
            !overText(element, x, y)),
      ) && !scanObstacles(canvas).some((rect) => contains(rect, x, y))
  );
}

export function scanObstacles(canvas: HTMLCanvasElement): DOMRect[] {
  const obstacles: DOMRect[] = [];
  const range = document.createRange();

  function visit(node: Node) {
    if (node instanceof Text) {
      if (!node.textContent?.trim()) return;
      range.selectNodeContents(node);
      obstacles.push(range.getBoundingClientRect());
      return;
    }
    if (!(node instanceof Element) || node === canvas) return;
    if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      return;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    if (paints(node, style) && !coversViewport(rect)) {
      obstacles.push(rect);
      return;
    }
    node.childNodes.forEach(visit);
  }

  document.body.childNodes.forEach(visit);
  return obstacles.filter(onScreen);
}
