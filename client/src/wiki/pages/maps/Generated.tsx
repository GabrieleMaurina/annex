import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Generated() {
  return (
    <>
      <WikiSection id="how" title="How generation works">
        <p>
          In the lobby, choose Generate to build a fresh map instead of picking
          one. The same seed and settings always produce the same map, so a seed
          is a map you can share. Seeds are 1 to 20 characters, and a random one
          is offered. Generating a map takes a moment and shows progress.
        </p>
      </WikiSection>
      <WikiSection id="type" title="Type">
        <WikiTable
          head={['Type', 'Look']}
          rows={[
            ['Terrain', 'Islands shaped like natural terrain.'],
            ['Dungeon', 'A maze divided by walls.'],
            ['Temple', 'A maze in its own layout style.'],
            ['Tile', 'A grid of regular polygons. Pick the tile shape.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="size" title="Size, fill and shape">
        <WikiTable
          head={['Option', 'Values', 'Meaning']}
          rows={[
            [
              'Size',
              'Small, Medium, Large, Extra Large',
              'Roughly sets the territory count.',
            ],
            [
              'Fill',
              'Full, Mixed, Sparse',
              'How much is playable territory versus sea or inaccessible space.',
            ],
            [
              'Tile',
              'Triangles, squares, hexagons and mixes',
              'The polygon used by Tile maps.',
            ],
            ['Shape', 'Wide, Square', 'The proportions of the map.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="extras" title="Extras">
        <WikiTable
          head={['Extra', 'Adds']}
          rows={[
            ['Seas', 'Splits water into seas that hold ships.'],
            ['Timed links', 'Links across water or void that open and close.'],
            ['Directional links', 'One-way links.'],
            [
              'Switches',
              'Flippable switches on links. Needs timed or directional links.',
            ],
            [
              'Unlockable',
              'Tile maps only: locked tiles to unlock in play. Not with seas or links.',
            ],
            [
              'Mountains, Rivers',
              'Terrain maps only: peaks and rivers that separate territories.',
            ],
          ]}
        />
        <p>
          Each is explained in <WikiLink to="maps/features" />.
        </p>
      </WikiSection>
      <WikiSection id="reuse" title="Reusing a generated map">
        <ul>
          <li>The home list can filter games by every generation option.</li>
          <li>
            Open the editor&apos;s Generate button to tweak a generated map and
            save it (<WikiLink to="maps/editor" />
            ).
          </li>
          <li>
            Maps from games can be saved to your library from the end screen.
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['maps/overview', 'maps/earth', 'play/games-list']} />
    </>
  );
}

export default Generated;
