import { Badge, Modal } from 'react-bootstrap';

const SECTIONS: { title: string; shortcuts: [string, string][] }[] = [
  {
    title: 'Menus',
    shortcuts: [
      ['M', 'Navigation menu'],
      ['O', 'Client settings'],
      ['Esc', 'Close the open menu or popup'],
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      ['C', 'Chat'],
      ['B', 'Continent bonuses'],
      ['T', 'Cards'],
      ['L', 'Logs'],
      ['S', 'Game settings'],
      ['N', 'Nukes'],
      ['P', 'Players panel'],
    ],
  },
  {
    title: 'Your turn',
    shortcuts: [
      ['Tab', 'Next phase, or players panel when you cannot advance'],
      ['Enter / Space', 'Confirm the open action'],
      ['Esc', 'Cancel the current selection'],
      ['Right-click', 'Deploy all troops, or buy the most ships'],
      ['Right-click', 'Blitz a target and move all troops in'],
      ['Right-click', 'Blitz enemy ships with all your ships'],
      ['Right-click', 'Fortify or sail everything to the target'],
      ['← ↓ / → ↑', 'Decrease / increase troops'],
      ['← ↑ / → ↓', 'Previous / next attack option'],
    ],
  },
  {
    title: 'Number inputs',
    shortcuts: [['← ↓ / → ↑', 'Decrease / increase']],
  },
  {
    title: 'Chat and messages',
    shortcuts: [
      ['Enter', 'Send'],
      ['Shift + Enter', 'New line in messages'],
    ],
  },
  {
    title: 'Map editor',
    shortcuts: [
      ['Ctrl + S', 'Save'],
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y / Ctrl + Shift + Z', 'Redo'],
      ['Delete / Backspace', 'Delete the selected territory or shape'],
      ['Esc', 'Deselect, or collapse the panel'],
      ['Ctrl + click', 'Connect wrapping horizontally'],
      ['Shift + click', 'Connect wrapping vertically'],
      ['Alt + click', 'Connect across other connections'],
      ['Shift + drag', 'Paint: keep shape proportions'],
      ['Alt + drag', 'Paint: draw from the center'],
      ['Ctrl + drag', 'Paint: pan the map'],
    ],
  },
];

function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal show onHide={onClose} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Shortcuts</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="d-flex flex-column gap-2">
            <div className="fw-semibold">{section.title}</div>
            {section.shortcuts.map(([keys, action]) => (
              <div
                key={keys + action}
                className="d-flex justify-content-between gap-3 small"
              >
                <Badge bg="secondary">{keys}</Badge>
                <span className="text-end">{action}</span>
              </div>
            ))}
          </div>
        ))}
      </Modal.Body>
    </Modal>
  );
}

export default ShortcutsPanel;
