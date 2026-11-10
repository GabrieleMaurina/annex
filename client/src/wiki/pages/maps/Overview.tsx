import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Overview() {
  return (
    <>
      <WikiSection id="what" title="What a map is">
        <p>
          A map is a picture plus a graph. The picture shows the territories,
          and the graph says which territories touch, which continent each
          belongs to and what each continent pays. Maps can also carry seas,
          special links, switches and names for places.
        </p>
      </WikiSection>
      <WikiSection id="kinds" title="Three kinds of map">
        <WikiTable
          head={['Kind', 'Where from', 'Page']}
          rows={[
            [
              'Library',
              'Drawn or saved by players. Browse, like and play any of them.',
              <WikiLink key="a" to="maps/library" />,
            ],
            [
              'Generated',
              'Built from a seed in a chosen style. Same seed, same map.',
              <WikiLink key="a" to="maps/generated" />,
            ],
            [
              'Earth',
              'Made from real places on Earth, from continents down to city streets.',
              <WikiLink key="a" to="maps/earth" />,
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="pick" title="Picking a map for a game">
        <p>
          In the lobby the host uses the Map control to pick a library map,
          generate one or build an Earth map. Without a map the game cannot
          start. Hovering a map shows a preview. The lobby, end screen and
          replay offer a like button for library maps.
        </p>
      </WikiSection>
      <WikiSection id="own" title="Make your own">
        <p>
          The map editor draws a map from scratch, from an image, from a
          generated map or from Earth data, and links the territories for you (
          <WikiLink to="maps/editor" />
          ). Saved maps join the library under your name.
        </p>
      </WikiSection>
      <WikiSection id="extras" title="Special features">
        <p>
          Seas, timed and directional links, switches, unlockable tiles, wraps
          and names are described in <WikiLink to="maps/features" />.
        </p>
      </WikiSection>
      <SeeAlso
        pages={['play/create', 'settings/reinforcements', 'rules/continents']}
      />
    </>
  );
}

export default Overview;
