import { MAX_TIMED_VALUE } from 'engine';
import { Button } from 'react-bootstrap';
import Tip from '../../../common/tooltips/Tip';
import { FIELD_LABEL_CLASS } from '../../../ui/containers/panelStyle';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import {
  switchLabels,
  wiredSwitchIds,
  withGate,
  withoutStaleWires,
} from '../model/switches';
import NumberCell from '../panel/NumberCell';
import type { GraphEdit } from './GraphPopover';

type TimedKey = 'delay' | 'open' | 'closed';
type DirectionalKey = 'forward' | 'backward';

const TIMED_KEYS: { key: TimedKey; label: string; min: number }[] = [
  { key: 'delay', label: 'Delay', min: 0 },
  { key: 'open', label: 'Open', min: 1 },
  { key: 'closed', label: 'Closed', min: 1 },
];

const DIRECTIONAL_KEYS: { key: DirectionalKey; label: string; min: number }[] =
  [
    { key: 'forward', label: 'Forward', min: 1 },
    { key: 'backward', label: 'Backward', min: 0 },
  ];

const TIMED_HELP =
  'Closed for the first Delay rounds, then open for Open rounds and closed for Closed rounds, repeating forever.';
const DIRECTIONAL_HELP =
  'Points forward for Forward rounds, then backward for Backward rounds, repeating forever. With Backward at 0 it always points forward.';
const GATE_HELP =
  'OR: the link is on while any of its switches is on. AND: only while all of them are on.';
const SWITCHED_HELP =
  'Wired to switches, so its schedule is ignored: a timed link is open while on, a directional link points forward while on and backward while off.';

interface Props {
  a: number;
  b: number;
  graph: GraphEdit;
  close: () => void;
}

function NumberRow({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
      <span className="small">{label}</span>
      <NumberCell
        value={value}
        min={min}
        max={MAX_TIMED_VALUE}
        className="text-center px-1"
        onChange={onChange}
      />
    </div>
  );
}

function LinkFields({ a, b, graph, close }: Props) {
  const { territories, setTerritories } = graph;
  const from = territories.find((t) => t.id === a);
  if (!from) return null;
  const timed = from.timed.find((m) => m.id === b);
  const directional = from.directional.find((m) => m.id === b);

  const update = (change: (t: Territory, otherId: number) => Territory) =>
    setTerritories((prev) =>
      withoutStaleWires(
        prev.map((t) =>
          t.id === a ? change(t, b) : t.id === b ? change(t, a) : t,
        ),
      ),
    );
  const remove = () => {
    update((t, otherId) => ({
      ...t,
      neighbors: t.neighbors.filter((n) => n !== otherId),
      timed: t.timed.filter((m) => m.id !== otherId),
      directional: t.directional.filter((m) => m.id !== otherId),
      wraps: t.wraps.filter((w) => w.id !== otherId),
    }));
    close();
  };

  const labels = switchLabels(territories);
  const switchIds = wiredSwitchIds(territories, a, b);
  const switched = switchIds.length > 0;
  const gate = timed?.gate ?? directional?.gate ?? 'or';
  const [start, end] = directional && !directional.out ? [b, a] : [a, b];
  const nameOf = (id: number) => labels.get(id) ?? id + 1;
  const title = timed
    ? `Timed link ${a + 1}↔${b + 1}`
    : directional
      ? `Directional link ${start + 1}→${end + 1}`
      : `Link ${nameOf(a)}↔${nameOf(b)}`;

  return (
    <>
      <div className={FIELD_LABEL_CLASS}>
        {(timed || directional) && !switched ? (
          <Tip text={timed ? TIMED_HELP : DIRECTIONAL_HELP}>
            <span>{title}</span>
          </Tip>
        ) : (
          title
        )}
      </div>
      {timed &&
        !switched &&
        TIMED_KEYS.map(({ key, label, min }) => (
          <NumberRow
            key={key}
            label={label}
            value={timed[key]}
            min={min}
            onChange={(value) =>
              update((t, otherId) => ({
                ...t,
                timed: t.timed.map((m) =>
                  m.id === otherId ? { ...m, [key]: value } : m,
                ),
              }))
            }
          />
        ))}
      {directional &&
        !switched &&
        DIRECTIONAL_KEYS.map(({ key, label, min }) => (
          <NumberRow
            key={key}
            label={label}
            value={directional[key]}
            min={min}
            onChange={(value) =>
              update((t, otherId) => ({
                ...t,
                directional: t.directional.map((m) =>
                  m.id === otherId ? { ...m, [key]: value } : m,
                ),
              }))
            }
          />
        ))}
      {switched && (
        <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
          <Tip text={SWITCHED_HELP}>
            <span className="small">
              Switches {switchIds.map((id) => labels.get(id)).join(', ')}
            </span>
          </Tip>
          {switchIds.length > 1 && (
            <Tip text={GATE_HELP}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setTerritories((prev) =>
                    withGate(prev, a, b, gate === 'or' ? 'and' : 'or'),
                  )
                }
              >
                {gate.toUpperCase()}
              </Button>
            </Tip>
          )}
        </div>
      )}
      <div className="d-flex gap-2 mt-2">
        {directional && (
          <Button
            variant="secondary"
            size="sm"
            className="w-100"
            onClick={() =>
              update((t, otherId) => ({
                ...t,
                directional: t.directional.map((m) =>
                  m.id === otherId ? { ...m, out: !m.out } : m,
                ),
              }))
            }
          >
            Reverse
          </Button>
        )}
        <Button variant="danger" size="sm" className="w-100" onClick={remove}>
          Delete
        </Button>
      </div>
    </>
  );
}

export default LinkFields;
