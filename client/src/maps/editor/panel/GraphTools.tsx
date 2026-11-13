import { Button, Form } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import Tip from '../../../common/tooltips/Tip';
import type { PaintTool } from '../paint/paintTools';
import type { TileOptions } from '../tiles/useTiles';
import TileTool from './TileTool';

const GRAPH_TOOLS: {
  key: PaintTool;
  label: string;
  icon: string;
  help: string;
}[] = [
  {
    key: 'territory',
    label: 'Territory',
    icon: '/icons/territory.svg',
    help: 'Click the map to add a territory in the continent picked by right-clicking. Click two territories to link or unlink them. Double-click a territory to delete it.',
  },
  {
    key: 'timed',
    label: 'Timed',
    icon: '/icons/stopwatch.svg',
    help: 'Click two land territories to add or remove a timed link. Select a link to edit its schedule.',
  },
  {
    key: 'directional',
    label: 'Directional',
    icon: '/icons/directional.svg',
    help: 'Click two land territories to add or remove a directional link from the first to the second. Select a link to edit or reverse it.',
  },
  {
    key: 'switch',
    label: 'Switch',
    icon: '/icons/switch.svg',
    help: 'Click the map to add a switch, then click land territories to let them flip it. With a switch selected, click a timed or directional link to wire or unwire it. Right-click a switch to change whether it starts on.',
  },
];

interface Props {
  tool: PaintTool | null;
  setTool: (tool: PaintTool | null) => void;
  tileOptions: TileOptions;
}

function GraphTools({ tool, setTool, tileOptions }: Props) {
  return (
    <div className="row row-cols-2 g-1 mb-2">
      {GRAPH_TOOLS.map((t) => (
        <div key={t.key} className="col">
          <Tip text={t.help}>
            <Button
              size="sm"
              variant={tool === t.key ? 'primary' : 'secondary'}
              onClick={() => setTool(tool === t.key ? null : t.key)}
              className="d-flex w-100 align-items-center justify-content-center gap-1"
            >
              <WhiteIcon path={t.icon} />
              {t.label}
            </Button>
          </Tip>
        </div>
      ))}
      <div className="col">
        <TileTool
          tool={tool}
          setTool={setTool}
          kind={tileOptions.kind}
          setKind={tileOptions.setKind}
        />
      </div>
      <div className="col d-flex align-items-center">
        <Form.Check
          type="switch"
          id="graph-unlockable"
          label="Unlockable"
          checked={tileOptions.unlockable}
          onChange={(e) => tileOptions.setUnlockable(e.target.checked)}
        />
      </div>
    </div>
  );
}

export default GraphTools;
