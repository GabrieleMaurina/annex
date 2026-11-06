import { linkKey } from 'engine';
import type { SwitchGate } from '../../../lib/types';
import type { SwitchWire, EditorTerritory as Territory } from './editorTypes';

function hasLink(t: Territory | undefined, otherId: number): boolean {
  return (
    !!t &&
    (t.timed.some((m) => m.id === otherId) ||
      t.directional.some((m) => m.id === otherId))
  );
}

export function regionVertices(territories: Territory[]): Territory[] {
  return territories.filter((t) => !t.switch);
}

export function switchLabels(territories: Territory[]): Map<number, string> {
  return new Map(
    territories.filter((t) => t.switch).map((t, i) => [t.id, `S${i + 1}`]),
  );
}

export function wiredSwitchIds(
  territories: Territory[],
  a: number,
  b: number,
): number[] {
  const key = linkKey(a, b);
  return territories
    .filter((t) => t.switch?.wires.some((w) => linkKey(w.a, w.b) === key))
    .map((t) => t.id);
}

export function withoutStaleWires(territories: Territory[]): Territory[] {
  const byId = new Map(territories.map((t) => [t.id, t]));
  const live = (w: SwitchWire) => hasLink(byId.get(w.a), w.b);
  return territories.map((t) =>
    t.switch && !t.switch.wires.every(live)
      ? { ...t, switch: { ...t.switch, wires: t.switch.wires.filter(live) } }
      : t,
  );
}

export function withWireToggled(
  territories: Territory[],
  switchId: number,
  wire: SwitchWire,
): Territory[] {
  const key = linkKey(wire.a, wire.b);
  return territories.map((t) => {
    if (t.id !== switchId || !t.switch) return t;
    const others = t.switch.wires.filter((w) => linkKey(w.a, w.b) !== key);
    return {
      ...t,
      switch: {
        ...t.switch,
        wires:
          others.length < t.switch.wires.length ? others : [...others, wire],
      },
    };
  });
}

export function withSwitchToggled(
  territories: Territory[],
  id: number,
): Territory[] {
  return territories.map((t) =>
    t.id === id && t.switch
      ? { ...t, switch: { ...t.switch, on: !t.switch.on } }
      : t,
  );
}

export function withGate(
  territories: Territory[],
  a: number,
  b: number,
  gate: SwitchGate,
): Territory[] {
  return territories.map((t) => {
    const otherId = t.id === a ? b : t.id === b ? a : null;
    if (otherId === null) return t;
    return {
      ...t,
      timed: t.timed.map((m) => (m.id === otherId ? { ...m, gate } : m)),
      directional: t.directional.map((m) =>
        m.id === otherId ? { ...m, gate } : m,
      ),
    };
  });
}
