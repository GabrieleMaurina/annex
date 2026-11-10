import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Shortcuts() {
  return (
    <>
      <p>
        Press K at any time to see this list in the game. Single-key shortcuts
        are ignored while you are typing in a box, and when Ctrl or Alt is held.
      </p>
      <WikiSection id="menus" title="Menus">
        <WikiTable
          head={['Key', 'Action']}
          rows={[
            ['M', 'Menu'],
            ['O', 'Client settings'],
            ['K', 'Shortcuts'],
            ['H', 'Hide or show the interface on the map'],
            [
              'Esc',
              'Show the hidden interface, or close the open menu or popup',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="panels" title="Panels">
        <WikiTable
          head={['Key', 'Panel']}
          rows={[
            ['C', 'Chat'],
            ['B', 'Bonuses'],
            ['T', 'Territory Cards'],
            ['L', 'Logs'],
            ['S', 'Game settings'],
            ['N', 'Nukes'],
            ['P', 'Players'],
          ]}
        />
      </WikiSection>
      <WikiSection id="turn" title="Your turn">
        <WikiTable
          head={['Input', 'Action']}
          rows={[
            ['Tab', 'Next phase, or the players panel when you cannot advance'],
            ['Enter, Space', 'Confirm the open action'],
            ['Esc', 'Cancel the current selection'],
            [
              'Right-click',
              'Deploy all troops, or buy the most ships. Blitz a target and move all troops in. Blitz enemy ships with all of yours. Fortify or sail everything to the target.',
            ],
            ['Middle-click', 'The same as right-click, but with the minimum'],
            [
              'Arrow keys',
              'Left and down decrease troops, right and up increase them',
            ],
            ['Left or up, right or down', 'Previous or next attack option'],
            ['%', 'Toggle percentage for troops and ships over 100'],
          ]}
        />
      </WikiSection>
      <WikiSection id="replay" title="Replay">
        <WikiTable
          head={['Input', 'Action']}
          rows={[
            ['Space', 'Play or pause'],
            ['Arrows, wheel or drag', 'Previous or next frame'],
            ['Ctrl', 'Step by turn'],
            ['Shift', 'Step by round'],
          ]}
        />
      </WikiSection>
      <WikiSection id="inputs" title="Number inputs and chat">
        <WikiTable
          head={['Input', 'Action']}
          rows={[
            ['Arrows, wheel, drag', 'Decrease or increase a value'],
            ['Ctrl, Shift', 'Step by 5 or by 10'],
            ['Enter', 'Send a chat or direct message'],
            ['Shift + Enter', 'New line in a message'],
          ]}
        />
      </WikiSection>
      <WikiSection id="editor" title="Map editor">
        <WikiTable
          head={['Input', 'Action']}
          rows={[
            ['Ctrl + S', 'Save'],
            ['Ctrl + Z', 'Undo'],
            ['Ctrl + Y, Ctrl + Shift + Z', 'Redo'],
            ['Delete, Backspace', 'Delete the selected territory or shape'],
            ['Double-click', 'Delete a territory'],
            ['Esc', 'Deselect or collapse the panel'],
            ['Ctrl + click', 'Link wrapping horizontally'],
            ['Shift + click', 'Link wrapping vertically'],
            ['Alt + click', 'Link across other links'],
            ['Shift + drag', 'Paint keeping shape proportions'],
            ['Alt + drag', 'Paint from the center'],
            ['Ctrl + drag', 'Pan the map while painting'],
          ]}
        />
        <p>
          More about the editor in <WikiLink to="maps/editor" />, and about the
          toy tanks in <WikiLink to="tools/tanks" />.
        </p>
      </WikiSection>
      <SeeAlso
        pages={[
          'start/game-screen',
          'tools/client-settings',
          'history/replays',
        ]}
      />
    </>
  );
}

export default Shortcuts;
