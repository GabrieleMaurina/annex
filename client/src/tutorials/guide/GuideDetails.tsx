import type { ReactNode } from 'react';
import { playSound } from '../../lib/sounds';
import { DefaultSettings, MapTypes, ModeExamples } from './GuideDiagrams';
import { RankLadder, SeaDiagram } from './GuideVisuals';

function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="mb-2" onToggle={() => playSound('click')}>
      <summary className="collapsible-summary">{title}</summary>
      <div className="px-1">{children}</div>
    </details>
  );
}

function GuideDetails() {
  return (
    <>
      <h4 id="learn-more" className="mt-4">
        Learn more
      </h4>

      <Details title="Game modes">
        <p>
          The game mode decides how you win. Whatever the mode, the last player
          standing wins, except in the kill-counting modes.
        </p>
        <ModeExamples />
        <ul>
          <li>
            <strong>Supremacy:</strong> own the whole map, or 3/4 or 2/3 of it
            in the quicker variants. Team Deathmatch is the same, fought in
            teams.
          </li>
          <li>
            <strong>Capitals and Continent:</strong> hold every capital, or one
            chosen continent.
          </li>
          <li>
            <strong>Round limits:</strong> after 5 or 10 rounds, whoever holds
            the most territories wins.
          </li>
          <li>
            <strong>Secret goals:</strong> in Assassin you hunt a hidden target,
            in Mission you complete a hidden mission.
          </li>
          <li>
            <strong>Scoring:</strong> Player Kills and Troop Kills reward the
            biggest destroyer, while King of the Hill and Empire hand out points
            every turn for holding hills or territories.
          </li>
        </ul>
      </Details>

      <Details title="Game settings">
        <p>
          The host shapes every game from the lobby. The ones that change the
          game the most:
        </p>
        <ul>
          <li>
            <strong>Blitz and dice:</strong> how instant battles resolve, how
            many dice each side rolls and who wins ties.
          </li>
          <li>
            <strong>Cards and Continents:</strong> how many troops sets and
            continents are worth, and whether they grow during the game.
          </li>
          <li>
            <strong>Placement:</strong> whether territories are dealt randomly
            or picked by the players.
          </li>
          <li>
            <strong>Fortification:</strong> how far troops can travel in the
            Fortify phase.
          </li>
          <li>
            <strong>Fog of war:</strong> only see territories near your own.
          </li>
          <li>
            <strong>Turn duration, alliances and bots:</strong> the pace, the
            diplomacy and who you play against.
          </li>
        </ul>
        <p className="mb-2">
          There are many more, from portals and entrenchments to toxins and
          nukes. Every setting in the lobby has a help tip that explains it.
        </p>
        <DefaultSettings />
      </Details>

      <Details title="Maps">
        <p>
          You can play on an endless list of maps. A map can be made by the
          community, generated automatically from a seed in one of several
          styles, or built from a real place on Earth. With an account you can
          save any map to your collection, and the best ones rise to the top as
          players like them.
        </p>
        <MapTypes />
        <ul>
          <li>
            <strong>Generated maps:</strong> pick a type (Terrain islands,
            Dungeon and Temple mazes, or a Tile grid), a size and a seed, and a
            fresh map appears. The same seed always gives the same map. Extras
            like seas, mountains and rivers can be switched on.
          </li>
          <li>
            <strong>Map library:</strong> the Maps page holds the maps players
            have saved. It lists the most liked first, so the community&apos;s
            favourites are easy to find. Like the ones you enjoy, filter to the
            maps you liked, and pick any of them for your next game.
          </li>
          <li>
            <strong>Map editor:</strong> draw your own map, start from an
            imported picture or a generated map, and let the editor find and
            link the territories for you. Save it to your maps and share it.
          </li>
          <li>
            <strong>Earth maps:</strong> turn any real place into a map, from
            whole continents split into countries down to the streets of a city.
          </li>
        </ul>
      </Details>

      <Details title="Elo and reputation">
        <p>
          Every account has two numbers, and they measure very different things.
        </p>
        <ul>
          <li>
            <strong>Elo is how well you play.</strong> It starts at 0 and
            changes after every game against other accounts: finishing above
            players raises it, finishing below them lowers it. It sets your
            rank, from Private all the way to General. Leaving a game early or
            disconnecting costs points.
          </li>
          <li>
            <strong>Reputation is how well you behave.</strong> It starts at 0
            and grows a little with each game you finish. Abandoning games and
            reports confirmed by several players, for things like abuse or
            collusion, bring it down. Below 0 it slowly recovers on its own, and
            it is only shown on your profile.
          </li>
        </ul>
        <RankLadder />
        <p className="mb-2">
          Hosts can require a minimum rank or reputation to join their games.
          Guests have neither until they create an account.
        </p>
      </Details>

      <Details title="Naval combat">
        <p>
          Some maps have seas. Seas belong to nobody, but you can fill them with
          ships.
        </p>
        <div className="d-flex flex-column flex-sm-row align-items-center gap-3 mb-3">
          <SeaDiagram />
          <div className="small">
            A sea is drawn as a blue hexagon. Each triangle around it is a
            fleet: its colour is the player who owns it and its number is how
            many ships that player has in this sea. Here red has 3 ships, blue 2
            and green 1. On some maps the sea is the water area itself instead
            of a hexagon, with the fleets around its centre.
          </div>
        </div>
        <ul>
          <li>
            <strong>Buying ships:</strong> during Deploy, a ship costs 3 troops,
            paid from the troops you are deploying or straight off a territory
            next to the sea (one troop always stays behind).
          </li>
          <li>
            <strong>Sailing:</strong> a Sail phase comes right after Deploy.
            Move your ships from one sea to any connected sea, the whole fleet
            if you like.
          </li>
          <li>
            <strong>Sea battles:</strong> during Attack, your ships can fight
            another player&apos;s ships in the same sea, with the same dice as
            on land.
          </li>
          <li>
            <strong>Crossing water:</strong> with more ships in a sea than an
            enemy territory&apos;s owner, you can attack that territory across
            the sea. Ships also carry troops across seas when you move them at
            the end of your turn.
          </li>
        </ul>
        <p>
          Ships never keep you alive: lose your last territory and you are out,
          fleet and all.
        </p>
      </Details>
    </>
  );
}

export default GuideDetails;
