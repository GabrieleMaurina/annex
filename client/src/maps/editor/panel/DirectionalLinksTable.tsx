import { MAX_TIMED_VALUE } from 'engine';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import Help from '../../../common/tooltips/Help';
import Tip from '../../../common/tooltips/Tip';
import type {
  LinkMode,
  EditorTerritory as Territory,
} from '../model/editorTypes';
import NumberCell from './NumberCell';

type DirectionalKey = 'forward' | 'backward';

const DIRECTIONAL_KEYS: { key: DirectionalKey; label: string; min: number }[] =
  [
    { key: 'forward', label: 'Forward', min: 1 },
    { key: 'backward', label: 'Backward', min: 0 },
  ];

const DIRECTIONAL_LINKS_HELP =
  'While on, linking two land territories creates a directional link from the first territory you click to the second (seas cannot have directional links). A directional link only works one way: it points forward for Forward rounds, then backward for Backward rounds, repeating forever. With Backward at 0 it always points forward. Every territory must still be able to reach every other territory.';

interface Props {
  territories: Territory[];
  setTerritories: Dispatch<SetStateAction<Territory[]>>;
  linkMode: LinkMode;
  setLinkMode: (value: LinkMode) => void;
}

function DirectionalLinksTable({
  territories,
  setTerritories,
  linkMode,
  setLinkMode,
}: Props) {
  const links = territories.flatMap((t) =>
    t.directional.filter((m) => m.out).map((m) => ({ ...m, a: t.id, b: m.id })),
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

  function setValue(a: number, b: number, key: DirectionalKey, value: number) {
    updatePair(a, b, (t, otherId) => ({
      ...t,
      directional: t.directional.map((m) =>
        m.id === otherId ? { ...m, [key]: value } : m,
      ),
    }));
  }

  function reverseLink(a: number, b: number) {
    updatePair(a, b, (t, otherId) => ({
      ...t,
      directional: t.directional.map((m) =>
        m.id === otherId ? { ...m, out: !m.out } : m,
      ),
    }));
  }

  function removeLink(a: number, b: number) {
    updatePair(a, b, (t, otherId) => ({
      ...t,
      directional: t.directional.filter((m) => m.id !== otherId),
      wraps: t.wraps.filter((w) => w.id !== otherId),
    }));
  }

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-2">
        <Form.Check
          type="switch"
          id="editor-directional-links"
          label={<Help tip={DIRECTIONAL_LINKS_HELP}>Directional links</Help>}
          checked={linkMode === 'directional'}
          disabled={linkMode === 'timed'}
          onChange={(e) =>
            setLinkMode(e.target.checked ? 'directional' : 'normal')
          }
        />
      </div>
      {links.length > 0 && (
        <Table size="sm" borderless className="mb-2 text-center align-middle">
          <thead>
            <tr>
              <th>Link</th>
              {DIRECTIONAL_KEYS.map(({ key, label }) => (
                <th key={key}>{label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={`${link.a}-${link.b}`}>
                <td className="text-nowrap">
                  <Tip text="Reverse">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => reverseLink(link.a, link.b)}
                    >
                      {link.a + 1}→{link.b + 1}
                    </Button>
                  </Tip>
                </td>
                {DIRECTIONAL_KEYS.map(({ key, min }) => (
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

export default DirectionalLinksTable;
