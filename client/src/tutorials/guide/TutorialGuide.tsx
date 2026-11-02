import { Badge } from 'react-bootstrap';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import GuideDetails from './GuideDetails';
import {
  AttackExample,
  CardSets,
  TerritoryLegend,
  TurnBarExample,
} from './GuideVisuals';

const PHASES = [
  {
    name: 'Deploy',
    text: 'Fresh troops arrive. Put them down on your territories, ideally where the fighting is.',
  },
  {
    name: 'Attack',
    text: 'Strike neighbouring enemy territories. Attack as many times as you dare, or not at all.',
  },
  {
    name: 'Fortify',
    text: 'Shift troops between your own connected territories to shore up your borders. This usually ends your turn.',
  },
];

function Die({ value, side }: { value: number; side: 'attack' | 'defence' }) {
  return (
    <Badge
      bg={side === 'attack' ? 'danger' : 'primary'}
      className="fs-5 px-2 py-1"
    >
      {value}
    </Badge>
  );
}

function DiceRow({
  label,
  values,
  side,
}: {
  label: string;
  values: number[];
  side: 'attack' | 'defence';
}) {
  return (
    <div className="d-flex align-items-center gap-2 mb-2">
      <span className="small fw-semibold" style={{ width: 70 }}>
        {label}
      </span>
      {values.map((value, i) => (
        <Die key={i} value={value} side={side} />
      ))}
    </div>
  );
}

function TutorialGuide() {
  return (
    <section>
      <h2 className="mb-3">How to play</h2>

      <h4>Conquer the map</h4>
      <p>
        Annex is a game of strategy, nerve and a little luck. Several players,
        humans or bots, share a map split into territories. Every territory
        belongs to someone, shows its owner&apos;s colour, and the number on it
        is how many troops are stationed there. Grow your empire, crush your
        rivals, and be the last commander standing.
      </p>
      <TerritoryLegend />

      <h4>Taking turns</h4>
      <p>
        Players take turns one after another. When it is your turn the bar at
        the bottom shows what to do, and the line at the top of the screen shows
        how much time you have left. A turn usually has three phases:
      </p>
      <TurnBarExample />
      <div className="row g-3 mb-4">
        {PHASES.map((phase, i) => (
          <div key={phase.name} className="col-md-4">
            <div className={`${SECTION_CLASS} p-3 h-100`}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Badge bg="secondary" pill>
                  {i + 1}
                </Badge>
                <span className="fw-bold fs-5">{phase.name}</span>
              </div>
              <div className="small">{phase.text}</div>
            </div>
          </div>
        ))}
      </div>

      <h4>How attacks work</h4>
      <p>
        Pick one of your territories with at least two troops, then a
        neighbouring enemy territory. One troop always stays behind to hold your
        ground. Both sides roll dice: the attacker up to three, the defender up
        to two. The highest dice are paired up and each pair is a duel. The
        higher die wins, the defender wins ties, and the loser of every duel
        loses one troop.
      </p>
      <div className={`${SECTION_CLASS} p-3 mb-3`}>
        <DiceRow label="Attacker" values={[6, 4, 2]} side="attack" />
        <DiceRow label="Defender" values={[5, 4]} side="defence" />
        <div className="small text-body-secondary">
          6 beats 5, so the defender loses a troop. 4 against 4 is a tie, so the
          attacker loses one. The third die has no partner.
        </div>
      </div>
      <p>
        Keep attacking until the defender runs out of troops, and the territory
        is yours: move some of your army in to hold it. In a hurry? A blitz
        fights the whole battle in one click.
      </p>
      <AttackExample />

      <h4>Growing stronger</h4>
      <p>
        At the start of each turn you receive troops based on how many
        territories you hold. Owning a whole continent pays a bonus on top.
        Conquer at least one territory during your turn to earn a card, and
        trade a set of three cards for a big batch of extra troops.
      </p>
      <CardSets />

      <h4>Tips for new commanders</h4>
      <ul>
        <li>Big stacks win battles. Do not spread your troops thin.</li>
        <li>Continents are easier to hold when they have few borders.</li>
        <li>Attack every turn if you can, cards add up fast.</li>
        <li>Practice against bots offline before taking on other players.</li>
      </ul>

      <GuideDetails />
    </section>
  );
}

export default TutorialGuide;
