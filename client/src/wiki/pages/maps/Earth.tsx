import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Earth() {
  return (
    <>
      <WikiSection id="what" title="What Earth maps are">
        <p>
          Earth maps turn a real place into a playable map. Territories follow
          real borders: countries on a world view, regions inside a country,
          districts and neighborhoods of a city, all the way down to blocks.
          They are built from OpenStreetMap data when you press Generate.
        </p>
      </WikiSection>
      <WikiSection id="choose" title="Choosing a place">
        <ul>
          <li>
            In the lobby or the editor open Earth, then search for a place or
            pan and zoom the world map.
          </li>
          <li>Random location picks somewhere for you.</li>
          <li>
            Drag on the map to outline your own area, or pick a place to limit
            the map to it. The close button on the place badge brings the
            surroundings back.
          </li>
        </ul>
      </WikiSection>
      <WikiSection id="options" title="Options">
        <WikiTable
          head={['Option', 'Meaning']}
          rows={[
            [
              'Size and shape',
              'Roughly how many territories, and wide or square proportions.',
            ],
            [
              'Detail',
              'Auto, or a level such as Countries, States / regions, Provinces / counties, Municipalities, Districts, Neighbourhoods and Blocks. Only levels available for your view can be chosen.',
            ],
            [
              'Seas, Timed links, Directional links, Switches',
              'The same extras as generated maps (see Special map features).',
            ],
            [
              'Mountains',
              'Rock, glaciers and, above city level, the most rugged real mountains become peaks. They are not territories.',
            ],
            [
              'Rivers',
              'Up to two major world rivers, like the Nile or the Danube, run across the map with a few bridges. Maps without one get none.',
            ],
            [
              'Green areas',
              'City level only. Large woods, grassland, farmland and wetland become gaps between territories.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="names" title="Names">
        <p>
          Territories, seas and continents carry real place names, shown on the
          map and in logs (<WikiLink to="maps/features#names" />
          ).
        </p>
      </WikiSection>
      <WikiSection id="remember" title="Remembered and saved">
        <ul>
          <li>
            Accounts remember the last Earth map as a recipe. The next game
            rebuilds it from current data, or falls back to a random generated
            map.
          </li>
          <li>
            Presets store Earth maps the same way, so a rebuilt map may differ
            slightly after a data update (
            <WikiLink to="settings/overview#presets" />
            ).
          </li>
          <li>
            In the editor you can save an Earth map to your library (
            <WikiLink to="maps/editor" />
            ).
          </li>
        </ul>
      </WikiSection>
      <SeeAlso pages={['maps/overview', 'maps/generated', 'maps/features']} />
    </>
  );
}

export default Earth;
