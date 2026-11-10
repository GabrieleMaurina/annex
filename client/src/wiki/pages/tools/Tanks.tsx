import SeeAlso from '../../parts/SeeAlso';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Tanks() {
  return (
    <>
      <WikiSection id="what" title="A toy behind the pages">
        <p>
          Little tanks roll around behind most pages. They are a toy and have no
          effect on games. They are hidden while you look at a game map, a
          replay or the map editor.
        </p>
      </WikiSection>
      <WikiSection id="play" title="Playing with them">
        <WikiTable
          head={['Input', 'Does']}
          rows={[
            ['Click or tap', 'Explosion'],
            ['Right-click, long-press', 'Spawns a tank'],
            ['Ctrl + right-click', 'Spawns a machine-gun tank'],
            ['1 to 9, 0', 'A tank of that color under the mouse'],
            ['Ctrl + 1 to 9, 0', 'A machine-gun tank of that color'],
            ['Middle-click', 'Concrete barrier'],
            ['Ctrl + middle-click', 'Landmine'],
            ['Middle-drag', 'A line of barriers'],
            ['Ctrl + middle-drag', 'A line of landmines'],
          ]}
        />
        <p>Hold the click, a color key or the right button to keep spawning.</p>
      </WikiSection>
      <SeeAlso pages={['tools/shortcuts', 'tools/client-settings']} />
    </>
  );
}

export default Tanks;
