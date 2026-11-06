import { duplicatePlaceNames } from 'engine';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useUiHidden } from '../../../common/menus/shortcuts/uiHidden';
import { useDragOffset } from '../../../ui/containers/dragOffset';
import {
  FIELD_LABEL_CLASS,
  PANEL_BG_CLASS,
  PANEL_CLASS,
} from '../../../ui/containers/panelStyle';
import type { GraphSelection } from '../canvas/graphPick';
import type { Point } from '../mapCanvasGeometry';
import {
  allPlaceNames,
  withoutVertex,
  type EditorTerritory as Territory,
} from '../model/editorTypes';
import { switchLabels, withSwitchToggled } from '../model/switches';
import PlaceNameInput from '../panel/PlaceNameInput';
import type { EditorTile } from '../tiles/editorTiles';
import LinkFields from './LinkFields';

const WIDTH = 230;
const OFFSET = 24;
const MARGIN = 8;

export interface GraphEdit {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  continentNames: string[];
  setContinentNames: Dispatch<SetStateAction<string[]>>;
  tiles: EditorTile[];
  toggleTile: (index: number) => void;
}

interface Props {
  selection: GraphSelection;
  anchor: Point;
  close: () => void;
  graph: GraphEdit;
}

function placement(anchor: Point): CSSProperties {
  const left = Math.max(
    MARGIN,
    Math.min(anchor.x + OFFSET, window.innerWidth - WIDTH - MARGIN),
  );
  return anchor.y > window.innerHeight / 2
    ? { left, bottom: window.innerHeight - anchor.y + OFFSET, width: WIDTH }
    : { left, top: anchor.y + OFFSET, width: WIDTH };
}

function SwitchFields({
  vertex,
  graph,
  close,
}: {
  vertex: Territory;
  graph: GraphEdit;
  close: () => void;
}) {
  const { territories, setTerritories } = graph;
  const wires = vertex.switch!.wires.length;
  return (
    <>
      <div className={FIELD_LABEL_CLASS}>
        Switch {switchLabels(territories).get(vertex.id)}
      </div>
      <Form.Check
        type="switch"
        id="popover-switch-on"
        label="Starts on"
        checked={vertex.switch!.on}
        onChange={() =>
          setTerritories((prev) => withSwitchToggled(prev, vertex.id))
        }
      />
      <div className="small text-body-secondary mb-2">
        {wires === 1 ? '1 wired link' : `${wires} wired links`}
      </div>
      <Button
        variant="danger"
        size="sm"
        className="w-100"
        onClick={() => {
          setTerritories((prev) => withoutVertex(prev, vertex.id));
          close();
        }}
      >
        Delete
      </Button>
    </>
  );
}

function GraphPopover({ selection, anchor, close, graph }: Props) {
  const { territories, setTerritories, continentNames, setContinentNames } =
    graph;
  const drag = useDragOffset(JSON.stringify(selection));
  const hiddenClass = useUiHidden() ? ' invisible' : '';
  const duplicates = duplicatePlaceNames(
    allPlaceNames(territories, continentNames),
  );
  const isDuplicate = (name: string) =>
    duplicates.has(name.trim().toLowerCase());

  const nameField = (
    label: string,
    value: string,
    placeholder: string,
    onChange: (value: string) => void,
  ) => (
    <>
      <div className={FIELD_LABEL_CLASS}>{label}</div>
      <PlaceNameInput
        value={value}
        placeholder={placeholder}
        duplicate={isDuplicate(value)}
        onChange={onChange}
      />
    </>
  );

  const vertex =
    selection.kind === 'vertex'
      ? territories.find((t) => t.id === selection.id)
      : undefined;
  const tileIndex = vertex
    ? graph.tiles.findIndex((tile) => tile.territoryId === vertex.id)
    : -1;
  const tileToggle = tileIndex >= 0 && (
    <Form.Check
      type="switch"
      id="popover-tile-unlockable"
      label="Unlockable"
      className="mt-2"
      checked={graph.tiles[tileIndex].unlockable}
      onChange={() => graph.toggleTile(tileIndex)}
    />
  );
  const content =
    selection.kind === 'link' ? (
      <LinkFields a={selection.a} b={selection.b} graph={graph} close={close} />
    ) : selection.kind === 'continent' ? (
      nameField(
        `Continent #${selection.id + 1} name`,
        continentNames[selection.id] ?? '',
        `Continent #${selection.id + 1}`,
        (value) =>
          setContinentNames((prev) =>
            prev.map((n, i) => (i === selection.id ? value : n)),
          ),
      )
    ) : !vertex ? null : vertex.locked ? (
      <>
        <div className={FIELD_LABEL_CLASS}>Locked tile</div>
        {tileToggle}
      </>
    ) : vertex.switch ? (
      <SwitchFields vertex={vertex} graph={graph} close={close} />
    ) : (
      <>
        {nameField(
          `${vertex.isSea ? 'Sea' : tileIndex >= 0 ? 'Tile' : 'Territory'} #${vertex.id + 1} name`,
          vertex.name,
          `#${vertex.id + 1}`,
          (value) =>
            setTerritories((prev) =>
              prev.map((t) => (t.id === vertex.id ? { ...t, name: value } : t)),
            ),
        )}
        {tileToggle}
      </>
    );
  return (
    <div
      className={`position-absolute z-2 ${PANEL_BG_CLASS} ${PANEL_CLASS}${hiddenClass}`}
      style={drag.shift(placement(anchor))}
      onPointerDown={drag.start}
    >
      {content}
    </div>
  );
}

export default GraphPopover;
