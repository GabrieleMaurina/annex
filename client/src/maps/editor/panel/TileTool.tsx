import { tileShapeLabel, tileVariants } from 'engine';
import { Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import Tip from '../../../common/tooltips/Tip';
import type { PaintTool } from '../paint/paintTools';
import { TILE_KINDS, type TileKind } from '../tiles/editorTiles';

const SIZE = 16;

function TileIcon({ kind }: { kind: TileKind }) {
  const [shape] = tileVariants(kind);
  const radius = Math.max(...shape.map(([x, y]) => Math.hypot(x, y)));
  const scale = (SIZE / 2 - 1) / radius;
  const points = shape
    .map(([x, y]) => `${SIZE / 2 + x * scale},${SIZE / 2 + y * scale}`)
    .join(' ');
  return (
    <svg width={SIZE} height={SIZE} fill="currentColor">
      <polygon points={points} />
    </svg>
  );
}

interface Props {
  tool: PaintTool | null;
  setTool: (tool: PaintTool | null) => void;
  kind: TileKind;
  setKind: (kind: TileKind) => void;
}

function TileTool({ tool, setTool, kind, setKind }: Props) {
  const active = tool === 'tiles';
  const variant = active ? 'primary' : 'secondary';
  return (
    <Dropdown
      as={ButtonGroup}
      className="w-100"
      onSelect={(key) => {
        if (!key) return;
        setKind(key as TileKind);
        setTool('tiles');
      }}
    >
      <Tip text="Place tile shapes">
        <Button
          size="sm"
          variant={variant}
          className="d-flex flex-grow-1 align-items-center justify-content-center gap-1"
          onClick={() => setTool(active ? null : 'tiles')}
        >
          <TileIcon kind={kind} />
          Tiles
        </Button>
      </Tip>
      <Tip text="Choose tile">
        <Dropdown.Toggle size="sm" variant={variant} split>
          <span className="visually-hidden">Choose tile</span>
        </Dropdown.Toggle>
      </Tip>
      <Dropdown.Menu>
        {TILE_KINDS.map((k) => (
          <Dropdown.Item
            key={k}
            as="button"
            eventKey={k}
            active={active && kind === k}
            className="d-flex align-items-center gap-2"
          >
            <TileIcon kind={k} />
            {tileShapeLabel(k)}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default TileTool;
