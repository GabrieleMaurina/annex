import { MAX_TIMED_VALUE } from 'engine';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import Help from '../../../common/tooltips/Help';
import type { EditorTerritory as Territory } from '../model/editorTypes';
import NumberCell from './NumberCell';

type TimedKey = 'delay' | 'open' | 'closed';

const TIMED_KEYS: { key: TimedKey; label: string; min: number }[] = [
  { key: 'delay', label: 'Delay', min: 0 },
  { key: 'open', label: 'Open', min: 1 },
  { key: 'closed', label: 'Closed', min: 1 },
];

const TIMED_LINKS_HELP =
  'While on, linking two land territories creates a timed connection instead of a normal one (seas cannot have timed connections). A timed connection is closed for the first Delay rounds, then stays open for Open rounds and closed for Closed rounds, repeating forever.';

interface Props {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  timedMode: boolean;
  setTimedMode: (value: boolean) => void;
}

function TimedLinksTable({
  territories,
  setTerritories,
  timedMode,
  setTimedMode,
}: Props) {
  const links = territories.flatMap((t) =>
    t.timed.filter((m) => t.id < m.id).map((m) => ({ ...m, a: t.id, b: m.id })),
  );

  function updatePair(
    a: number,
    b: number,
    change: (t: Territory, otherId: number) => Territory,
  ) {
    setTerritories((prev) =>
      prev.map((t) =>
        t.id === a ? change(t, b) : t.id === b ? change(t, a) : t,
      ),
    );
  }

  function setValue(a: number, b: number, key: TimedKey, value: number) {
    updatePair(a, b, (t, otherId) => ({
      ...t,
      timed: t.timed.map((m) =>
        m.id === otherId ? { ...m, [key]: value } : m,
      ),
    }));
  }

  function removeLink(a: number, b: number) {
    updatePair(a, b, (t, otherId) => ({
      ...t,
      timed: t.timed.filter((m) => m.id !== otherId),
      wraps: t.wraps.filter((w) => w.id !== otherId),
    }));
  }

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-2">
        <Form.Check
          type="switch"
          id="editor-timed-links"
          label="Timed links"
          checked={timedMode}
          onChange={(e) => setTimedMode(e.target.checked)}
        />
        <Help>{TIMED_LINKS_HELP}</Help>
      </div>
      {links.length > 0 && (
        <Table size="sm" borderless className="mb-2 text-center align-middle">
          <thead>
            <tr>
              <th>Link</th>
              {TIMED_KEYS.map(({ key, label }) => (
                <th key={key}>{label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={`${link.a}-${link.b}`}>
                <td className="text-nowrap">
                  {link.a + 1}↔{link.b + 1}
                </td>
                {TIMED_KEYS.map(({ key, min }) => (
                  <td key={key}>
                    <NumberCell
                      value={link[key]}
                      min={min}
                      max={MAX_TIMED_VALUE}
                      className="text-center px-1"
                      onChange={(value) => setValue(link.a, link.b, key, value)}
                    />
                  </td>
                ))}
                <td>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeLink(link.a, link.b)}
                  >
                    <WhiteIcon path="/icons/close.svg" size={12} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default TimedLinksTable;
