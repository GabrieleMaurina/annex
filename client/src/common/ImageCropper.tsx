import { useEffect, useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

const STAGE = 320;
const WINDOW = 200;
const OUTPUT = 1000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type Point = { x: number; y: number };

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clampOffset(
  point: Point,
  zoom: number,
  image: HTMLImageElement,
  baseScale: number,
): Point {
  const scale = baseScale * zoom;
  const maxX = Math.max(0, (image.width * scale - WINDOW) / 2);
  const maxY = Math.max(0, (image.height * scale - WINDOW) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, point.x)),
    y: Math.min(maxY, Math.max(-maxY, point.y)),
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface Props {
  file: File;
  onCancel: () => void;
  onCropped: (image: string) => void;
}

function ImageCropper({ file, onCancel, onCropped }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ zoom, offset, image, baseScale: 1 });
  const pointers = useRef(new Map<number, Point>());
  const dragStart = useRef<{ pointer: Point; offset: Point } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = image
    ? Math.max(WINDOW / image.width, WINDOW / image.height)
    : 1;
  const scale = baseScale * zoom;

  useEffect(() => {
    stateRef.current = { zoom, offset, image, baseScale };
  });

  function applyZoom(next: number) {
    const clamped = clampZoom(next);
    setZoom(clamped);
    if (image)
      setOffset((current) => clampOffset(current, clamped, image, baseScale));
  }

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const state = stateRef.current;
      if (!state.image) return;
      const next = clampZoom(state.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      setZoom(next);
      setOffset(clampOffset(state.offset, next, state.image, state.baseScale));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];
    if (points.length === 1) {
      dragStart.current = { pointer: points[0], offset };
      pinchStart.current = null;
    } else if (points.length === 2) {
      pinchStart.current = { distance: distance(points[0], points[1]), zoom };
      dragStart.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];

    if (points.length >= 2 && pinchStart.current) {
      const spread = distance(points[0], points[1]);
      if (pinchStart.current.distance > 0)
        applyZoom(
          (pinchStart.current.zoom * spread) / pinchStart.current.distance,
        );
      return;
    }

    if (dragStart.current && image) {
      const { pointer, offset: start } = dragStart.current;
      setOffset(
        clampOffset(
          {
            x: start.x + e.clientX - pointer.x,
            y: start.y + e.clientY - pointer.y,
          },
          zoom,
          image,
          baseScale,
        ),
      );
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const points = [...pointers.current.values()];
    pinchStart.current = null;
    dragStart.current =
      points.length === 1 ? { pointer: points[0], offset } : null;
  }

  function save() {
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const source = WINDOW / scale;
    const sx = (image.width - source) / 2 - offset.x / scale;
    const sy = (image.height - source) / 2 - offset.y / scale;
    ctx.drawImage(image, sx, sy, source, source, 0, 0, OUTPUT, OUTPUT);
    onCropped(canvas.toDataURL('image/jpeg', 0.9));
  }

  return (
    <Modal show onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Crop picture</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column align-items-center gap-3">
        <div
          ref={stageRef}
          className="position-relative overflow-hidden rounded bg-dark"
          style={{
            width: STAGE,
            height: STAGE,
            touchAction: 'none',
            cursor: 'move',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {image && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="position-absolute top-50 start-50"
              style={{
                width: image.width * scale,
                height: image.height * scale,
                maxWidth: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <div
            className="position-absolute top-50 start-50 translate-middle rounded pe-none"
            style={{
              width: WINDOW,
              height: WINDOW,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              outline: '1px solid rgba(255, 255, 255, 0.9)',
            }}
          />
        </div>
        <Form.Range
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          style={{ maxWidth: STAGE }}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!image}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ImageCropper;
