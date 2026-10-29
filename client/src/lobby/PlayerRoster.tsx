import { Button } from 'react-bootstrap';
import { useWhiteIcon } from '../common/icon';
import Tip from '../common/tooltips/Tip';
import { connector } from '../connector';
import { GLOBAL_TARGET_ID } from '../game/logic/emoji';
import type { BotDifficulty, BotPersonality, GameState } from '../lib/types';
import RosterTable from './roster/RosterTable';
import type { TeamLayout } from './roster/teamLayout';
import TeamRoster from './roster/TeamRoster';

export interface RosterProps {
  game: GameState;
  isHost: boolean;
  isTeamDeathmatch: boolean;
  selfId: number | null;
  setTeams: (teams: TeamLayout) => void;
  cycleColor: () => void;
  cycleBotColor: (botPlayerId: number) => void;
  removePlayer: (playerId: number) => void;
  removeEmptySlot: () => void;
  addSlot: () => void;
  addBot: (team?: number) => void;
  addLocalPlayer?: (team?: number) => void;
  setLocalPlayerName?: (playerId: number, name: string) => void;
  cycleLocalPlayerColor?: (playerId: number) => void;
  setBotProfile: (
    botPlayerId: number,
    difficulty: BotDifficulty | 'random',
    personality: BotPersonality | 'random',
  ) => void;
  removeBot: (botPlayerId: number) => void;
  rowRefs: React.RefObject<Map<number, HTMLElement>>;
  nameCellRefs: React.RefObject<Map<number, HTMLElement>>;
  onEmojiRowClick: (playerId: number) => void;
}

function PlayerRoster(roster: RosterProps) {
  const {
    game,
    isTeamDeathmatch,
    removeEmptySlot,
    addSlot,
    rowRefs,
    nameCellRefs,
    onEmojiRowClick,
  } = roster;
  const slotRows = Array.from(
    { length: game.slots },
    (_, i) => game.players[i] ?? null,
  );
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');

  return (
    <>
      {isTeamDeathmatch ? (
        <TeamRoster roster={roster} />
      ) : (
        <RosterTable
          roster={roster}
          rows={slotRows}
          addSlot={addSlot}
          removeEmptySlot={removeEmptySlot}
        />
      )}
      {!connector.isOffline() && (
        <div className="d-flex justify-content-start mt-1">
          <Tip text="Everyone" placement="bottom">
            <Button
              variant="secondary"
              size="sm"
              className="d-inline-flex align-items-center justify-content-center"
              style={{ width: 28, height: 28, padding: 0 }}
              onClick={() => onEmojiRowClick(GLOBAL_TARGET_ID)}
              ref={(el) => {
                if (el) {
                  rowRefs.current.set(GLOBAL_TARGET_ID, el);
                  nameCellRefs.current.set(GLOBAL_TARGET_ID, el);
                } else {
                  rowRefs.current.delete(GLOBAL_TARGET_ID);
                  nameCellRefs.current.delete(GLOBAL_TARGET_ID);
                }
              }}
            >
              <img
                src={whiteGlobeIcon ?? '/icons/globe.svg'}
                width={14}
                height={14}
                alt="Everyone"
              />
            </Button>
          </Tip>
        </div>
      )}
    </>
  );
}

export default PlayerRoster;
