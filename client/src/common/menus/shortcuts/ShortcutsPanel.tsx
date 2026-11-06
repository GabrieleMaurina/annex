import { useEffect, useSyncExternalStore } from 'react';
import { Badge, Modal } from 'react-bootstrap';
import { isTypingTarget } from '../../../game/GameMap/helpers';
import { useToggleSound } from '../../../lib/sounds';
import {
  getShortcutsOpen,
  setShortcutsOpen,
  subscribeShortcutsOpen,
} from './shortcutsOpen';

const SECTIONS: { title: string; shortcuts: [string, string][] }[] = [
  {
    title: 'Menus',
    shortcuts: [
      ['M', 'Menu'],
      ['O', 'Client settings'],
      ['K', 'Shortcuts'],
      ['H', 'Hide or show the UI on the map'],
      ['Esc', 'Show the hidden UI'],
      ['Esc', 'Close the open menu or popup'],
    ],
  },
  {
    title: 'Panels',
    shortcuts: [
      ['C', 'Chat'],
      ['B', 'Bonuses'],
      ['T', 'Territory Cards'],
      ['L', 'Logs'],
      ['S', 'Game settings'],
      ['N', 'Nukes'],
      ['P', 'Players'],
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
      ['Middle-click', 'Like right-click, but with the minimum'],
      ['← ↓ / → ↑', 'Decrease / increase troops'],
      ['← ↑ / → ↓', 'Previous / next attack option'],
      ['%', 'Toggle percentage for troops and ships over 100'],
    ],
  },
  {
    title: 'Replay',
    shortcuts: [
      ['Space', 'Play / pause'],
      ['← ↓ / → ↑', 'Previous / next frame'],
      ['Wheel', 'Previous / next frame, over the replay bar'],
      ['Drag ← ↓ / → ↑', 'Previous / next frame, on the replay bar'],
      ['Ctrl', 'Step by turn (arrows, wheel, drag)'],
      ['Shift', 'Step by round (arrows, wheel, drag)'],
    ],
  },
  {
    title: 'Number inputs',
    shortcuts: [
      ['← ↓ / → ↑', 'Decrease / increase'],
      ['Ctrl / Shift', 'Step by 5 / 10 (arrows, wheel, drag, spinner)'],
    ],
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
      ['Double-click / double-tap', 'Delete a territory'],
      ['Esc', 'Deselect, or collapse the panel'],
      ['Ctrl + click', 'Link wrapping horizontally'],
      ['Shift + click', 'Link wrapping vertically'],
      ['Alt + click', 'Link across other links'],
      ['Shift + drag', 'Paint: keep shape proportions'],
      ['Alt + drag', 'Paint: draw from the center'],
      ['Ctrl + drag', 'Paint: pan the map'],
    ],
  },
  {
    title: 'Background tanks',
    shortcuts: [
      ['Click / tap', 'Explosion'],
      ['Right-click / long-press', 'Tank'],
      ['Ctrl + right-click', 'Machine-gun tank'],
      ['Middle-click', 'Concrete barrier'],
      ['Hold click', 'Keep spawning explosions'],
      ['Hold right-click', 'Keep spawning tanks'],
      ['Hold Ctrl + right-click', 'Keep spawning machine-gun tanks'],
      ['Middle-drag', 'Line of barriers'],
    ],
  },
];

function ShortcutsPanel() {
  const open = useSyncExternalStore(subscribeShortcutsOpen, getShortcutsOpen);
  useToggleSound(open);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target))
        return;
      if (e.key.toLowerCase() === 'k') setShortcutsOpen(!getShortcutsOpen());
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <Modal show onHide={() => setShortcutsOpen(false)} centered scrollable>
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
