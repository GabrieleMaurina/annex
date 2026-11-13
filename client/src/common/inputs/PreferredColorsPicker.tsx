import { PLAYER_COLOR_NAMES } from 'engine';
import { type CSSProperties, useState } from 'react';
import { contrastTextColor, PLAYER_COLORS } from '../../lib/palette';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { type DropHit, GAP, useDrag } from '../../ui/dnd/dragDrop';
import DragGhost from '../../ui/dnd/DragGhost';
import Tip from '../tooltips/Tip';

const ALL_COLORS = PLAYER_COLORS.map((_, color) => color);
const SWATCH_SIZE = 28;
const BOX_HEIGHT = 84;

function insertAt(list: number[], color: number, index?: number) {
  const rest = list.filter((c) => c !== color);
  rest.splice(index ?? rest.length, 0, color);
  return rest;
}

function sortedIndex(list: number[], color: number) {
  const at = list.findIndex((c) => c > color);
  return at === -1 ? list.length : at;
}

function slotsOf(list: number[], gapAt: number | null) {
  const items = list.map((color, index) => ({ color, index }));
  if (gapAt === null) return items;
  return [...items.slice(0, gapAt), GAP, ...items.slice(gapAt)];
}

function PreferredColorsPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (colors: number[]) => void;
}) {
  const [preferred, setPreferred] = useState(value);
  const { drag, start, snapshot, register } = useDrag<number>();

  function commit(next: number[]) {
    if (next.join() === preferred.join()) return;
    setPreferred(next);
    onChange(next);
  }

  function dropColor(color: number, hit: DropHit | null) {
    if (hit?.zone === 'available') commit(preferred.filter((c) => c !== color));
    else if (hit?.zone === 'preferred')
      commit(insertAt(preferred, color, hit.index));
  }

  function clickSwatch(color: number) {
    snapshot();
    commit(
      preferred.includes(color)
        ? preferred.filter((c) => c !== color)
        : [...preferred, color],
    );
  }

  const dragged = drag?.item ?? null;
  const hover = drag?.hover ?? null;
  const previewing = dragged !== null && hover !== null;
  const prefView = previewing
    ? preferred.filter((c) => c !== dragged)
    : preferred;
  const availView = ALL_COLORS.filter(
    (c) => !preferred.includes(c) && (!previewing || c !== dragged),
  );
  const prefGap =
    previewing && hover.zone === 'preferred'
      ? (hover.index ?? prefView.length)
      : null;
  const availGap =
    previewing && hover.zone === 'available'
      ? sortedIndex(availView, dragged)
      : null;

  function chip(color: number, rank?: number) {
    const fill = PLAYER_COLORS[color];
    return (
      <span
        className="btn p-0 d-flex align-items-center justify-content-center small fw-bold"
        style={
          {
            width: SWATCH_SIZE,
            height: SWATCH_SIZE,
            border: 0,
            backgroundColor: fill,
            color: contrastTextColor(fill),
            '--button-lip': `color-mix(in srgb, ${fill} 65%, #000)`,
            '--button-fx-color': fill,
            '--button-fx-glow': fill,
          } as CSSProperties
        }
      >
        {rank}
      </span>
    );
  }

  function gap(zone: string, index?: number) {
    return (
      <div
        key="gap"
        ref={register('gap')}
        data-drop-zone={zone}
        data-drop-index={index}
        data-drop-exact="true"
        className="rounded"
        style={{
          width: SWATCH_SIZE,
          height: SWATCH_SIZE,
          border: '2px dashed var(--bs-primary)',
        }}
      />
    );
  }

  function swatch(color: number, zone: string, index: number, rank?: number) {
    return (
      <Tip
        key={color}
        text={
          preferred.includes(color)
            ? `Remove ${PLAYER_COLOR_NAMES[color]} from preferred colors`
            : `Prefer ${PLAYER_COLOR_NAMES[color]}`
        }
      >
        <button
          type="button"
          ref={register(String(color))}
          data-drop-zone={zone}
          data-drop-index={index}
          className="p-0 border-0 bg-transparent"
          onClick={() => clickSwatch(color)}
          onPointerDown={(e) => start(e, color, (hit) => dropColor(color, hit))}
          style={{
            touchAction: 'none',
            opacity: dragged === color && !previewing ? 0.35 : 1,
          }}
        >
          {chip(color, rank)}
        </button>
      </Tip>
    );
  }

  const prefSlots = slotsOf(prefView, prefGap);
  const availSlots = slotsOf(availView, availGap);

  return (
    <div className="d-flex flex-column gap-2 w-100">
      <div className="small text-muted">Preferred, in order</div>
      <div
        data-drop-zone="preferred"
        className={`d-flex flex-wrap align-content-start gap-2 p-2 ${SECTION_CLASS}`}
        style={{ height: BOX_HEIGHT }}
      >
        {prefSlots.length === 0 && (
          <span className="small text-muted">Click or drag colors here</span>
        )}
        {prefSlots.map((slot, position) =>
          slot === GAP
            ? gap('preferred', prefGap ?? undefined)
            : swatch(slot.color, 'preferred', slot.index, position + 1),
        )}
      </div>
      <div className="small text-muted">Available</div>
      <div
        data-drop-zone="available"
        className={`d-flex flex-wrap align-content-start gap-2 p-2 ${SECTION_CLASS}`}
        style={{ height: BOX_HEIGHT }}
      >
        {availSlots.map((slot) =>
          slot === GAP
            ? gap('available')
            : swatch(slot.color, 'available', slot.index),
        )}
      </div>
      <DragGhost drag={drag} render={(color) => chip(color)} />
    </div>
  );
}

export default PreferredColorsPicker;
