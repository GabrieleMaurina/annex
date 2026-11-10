import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Editor() {
  return (
    <>
      <p>
        The editor is for accounts. Open it from My maps (
        <WikiLink app="/maps/mine">My maps</WikiLink>) and press the create
        button. The panel on the map has the tools.
      </p>
      <WikiSection id="start" title="Starting a map">
        <WikiTable
          head={['Button', 'Does']}
          rows={[
            ['New', 'A blank canvas in Small, Medium, Large or Extra Large.'],
            [
              'Generate',
              'Builds a generated map to edit (see Generated maps).',
            ],
            ['Earth', 'Builds a map of a real place.'],
            ['Import image', 'Uses your own picture as the map art.'],
            ['Import map', 'Starts from a library map.'],
          ]}
        />
      </WikiSection>
      <WikiSection id="paint" title="Drawing the picture">
        <p>
          The image is the map. Territories are the areas between border lines.
          The paint tools are pencil, eraser, line, curve, shape, fill, color
          picker, select and lasso, plus a tiles tool for regular polygons.
          Select and lasso lift an area as a shape you can move and copy.
        </p>
        <ul>
          <li>Colors and brush sizes are in the panel.</li>
          <li>
            Borders is the color list the editor treats as walls between
            territories.
          </li>
          <li>
            Clickable areas checks that every territory can actually be clicked
            in game.
          </li>
          <li>
            Preview borders and Preview smoothing show how the map will look
            when played.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="graph" title="Linking territories">
        <WikiTable
          head={['Tool', 'Does']}
          rows={[
            [
              'Territory',
              'Click to add a territory, in the continent chosen by right-clicking. Click two to link or unlink them. Double-click to delete.',
            ],
            [
              'Timed',
              'Click two land territories to add or remove a timed link, then select it to edit its schedule.',
            ],
            [
              'Directional',
              'Click two land territories to add a one-way link from the first to the second.',
            ],
            [
              'Switch',
              'Click to place a switch, then click territories that may flip it. With a switch selected, click a link to wire it.',
            ],
            [
              'Tiles',
              'Places polygons that become territories, with edge snapping.',
            ],
          ]}
        />
        <p>
          The editor can also find territories and suggest links for you. Useful
          shortcuts are on <WikiLink to="tools/shortcuts" />.
        </p>
      </WikiSection>
      <WikiSection id="continents" title="Continents and names">
        <p>
          The Continents section lists each continent, its size and its bonus.
          Territories, seas and continents can be named (
          <WikiLink to="maps/features#names" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="save" title="Saving">
        <ul>
          <li>
            Name it (1 to 40 characters, unique among your maps) and press Save.
          </li>
          <li>
            Save is disabled until there are changes and no problems. The editor
            reports problems, such as territories that cannot reach each other.
          </li>
          <li>Undo and redo cover painting and linking.</li>
          <li>Leave asks before throwing away unsaved work.</li>
        </ul>
        <Callout kind="tip">
          Saved maps are public in the library under your name and can be liked.
          Updating one keeps its likes (<WikiLink to="maps/library" />
          ).
        </Callout>
      </WikiSection>
      <SeeAlso pages={['maps/features', 'maps/generated', 'tools/shortcuts']} />
    </>
  );
}

export default Editor;
