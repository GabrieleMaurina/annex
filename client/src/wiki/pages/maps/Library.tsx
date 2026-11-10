import Callout from '../../parts/Callout';
import SeeAlso from '../../parts/SeeAlso';
import WikiLink from '../../parts/WikiLink';
import WikiSection from '../../parts/WikiSection';
import WikiTable from '../../parts/WikiTable';

function Library() {
  return (
    <>
      <WikiSection id="browse" title="Browsing">
        <p>
          Open <WikiLink app="/maps">Maps</WikiLink> from the menu. Every
          published map is listed with name, author, territories, continents and
          likes. Click a row for a preview.
        </p>
        <WikiTable
          head={['Control', 'Does']}
          rows={[
            ['Sort', 'Most liked (default), newest or oldest.'],
            ['Search', 'Matches map names, or the start of an author name.'],
            ['Territories', 'Keeps maps within a range of territory counts.'],
            ['Owner', 'Anyone, my maps, or not my maps. Accounts only.'],
            ['Likes', 'Any, liked or not liked by you. Accounts only.'],
            [
              'Generated type, tile, fill, size, seas, links, switches, unlockable',
              'Finds maps that started as generated maps with those options.',
            ],
          ]}
        />
      </WikiSection>
      <WikiSection id="like" title="Liking and reporting">
        <ul>
          <li>
            Accounts can like a map. The most liked rise to the top. Ten likes
            earn its author the Popular achievement (
            <WikiLink to="accounts/achievements" />
            ).
          </li>
          <li>
            Accounts can report a map. If enough different players report it, it
            is marked dangerous: it vanishes from the library and cannot be
            played, and its author loses reputation.
          </li>
          <li>Authors cannot report their own maps.</li>
        </ul>
      </WikiSection>
      <WikiSection id="mine" title="My maps">
        <p>
          Accounts have a My maps page to open the editor, create a map and
          delete their own (<WikiLink to="maps/editor" />
          ). Names are unique per author, 1 to 40 characters. A dangerous map
          still shows to its author, who can delete but not edit it.
        </p>
      </WikiSection>
      <WikiSection id="rules" title="Image rules">
        <p>
          Images are PNG, JPEG or WebP up to 5 MB and go through automatic
          moderation. A flagged image is refused.
        </p>
        <Callout kind="note">
          Saving over a map keeps its likes and reports.
        </Callout>
      </WikiSection>
      <WikiSection id="elsewhere" title="Saving a map from a game">
        <p>
          On the end screen or in a replay, an account can save the game&apos;s
          map to its own library (
          <WikiLink to="history/replays" />
          ).
        </p>
      </WikiSection>
      <SeeAlso
        pages={['maps/editor', 'maps/generated', 'ranking/reputation']}
      />
    </>
  );
}

export default Library;
