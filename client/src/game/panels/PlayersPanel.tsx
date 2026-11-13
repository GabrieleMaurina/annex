import { isPointsMode } from 'engine';
import type { MutableRefObject } from 'react';
import { memo, useReducer, useRef, useState } from 'react';
import { Button, ListGroup } from 'react-bootstrap';
import Flag from '../../common/badges/Flag';
import RankIcon from '../../common/badges/RankIcon';
import { panelConduct } from '../../common/conduct/panelConduct';
import { useDismissOnOutsideClick } from '../../common/dismiss/useDismissOnOutsideClick';
import { useWhiteIcon } from '../../common/icon';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';
import { connector } from '../../connector';
import type {
  Alliances,
  BotSpeed,
  Bounties,
  CardsMode,
  FriendsOverview,
  GameMode,
  GameState,
  Mission,
  Starvation,
  Toxins,
  TurnPhase,
} from '../../lib/types';
import { titleCase } from '../../lobby/settings/gameSettings';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';
import { GLOBAL_TARGET_ID, type EmojiPop } from '../logic/emoji';
import { formatMission } from './mission/formatMission';
import PlayerActions from './players/PlayerActions';
import PlayerDetailsPopover from './players/PlayerDetailsPopover';
import { levelFor } from './players/playerLevels';
import PlayersRoster from './players/PlayersRoster';
import { statDefs } from './players/playerStats';
import { registerRef } from './players/registerRef';
import { playerStatuses } from './players/rows/playerStatuses';
import { useSingleColumnFit } from './players/useSingleColumnFit';

interface Props {
  players: GameState['players'];
  spectators: GameState['spectators'];
  gameMode: GameMode;
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  starvation: Starvation;
  bounties: Bounties;
  cards: CardsMode;
  territoryTroopsCap: number;
  totalTroopsCap: number;
  leaderTerritoryCount: number | null;
  territoriesToWin: number | null;
  maxPoints: number;
  toxins: Toxins;
  toxinsCost: number;
  mission: Mission | null;
  continentNames: Map<number, string>;
  selfId: number | null;
  hostId: number;
  paused: boolean;
  pauseUsed: boolean;
  botSpeed: BotSpeed;
  onTogglePause: () => void;
  onCycleBotSpeed: () => void;
  onSurrender: () => void;
  earlyWin: boolean;
  onEndGame: () => void;
  drawOffersOpen: boolean;
  drawVoteIds: number[];
  onToggleDraw: () => void;
  abortOpen: boolean;
  abortVoteIds: number[];
  onToggleAbort: () => void;
  roundNumber: number;
  turnPhase: TurnPhase;
  turnPlayerId: number | null;
  gameEnded: boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  navigate: (path: string) => void;
  rowRefs: MutableRefObject<Map<number, HTMLElement>>;
  onRowClick: (playerId: number) => void;
  emojiTargeting: boolean;
  emojiPops: EmojiPop[];
  emojiAllowedIds: Set<number> | null;
  alliances: Alliances;
  allianceStates: GameState['allianceStates'];
  allianceCellRefs: MutableRefObject<Map<number, HTMLElement>>;
  onAllianceCellClick: (playerId: number) => void;
  allianceCooldownIds: Set<number>;
  storedGameId?: string;
  endedAt: number | null;
  conductFriends?: FriendsOverview;
  conductBlockedUserIds?: string[];
  onConductChange?: () => void;
  anonymous: boolean;
  recoloredIds?: Set<number>;
  onCycleColor?: (playerId: number) => void;
}

function PlayersPanel({
  players,
  spectators,
  gameMode,
  isTeamDeathmatch,
  isCapitals,
  starvation,
  bounties,
  cards,
  territoryTroopsCap,
  totalTroopsCap,
  leaderTerritoryCount,
  territoriesToWin,
  maxPoints,
  toxins,
  toxinsCost,
  mission,
  continentNames,
  selfId,
  hostId,
  paused,
  pauseUsed,
  botSpeed,
  onTogglePause,
  onCycleBotSpeed,
  onSurrender,
  earlyWin,
  onEndGame,
  drawOffersOpen,
  drawVoteIds,
  onToggleDraw,
  abortOpen,
  abortVoteIds,
  onToggleAbort,
  roundNumber,
  turnPhase,
  turnPlayerId,
  gameEnded,
  collapsed,
  setCollapsed,
  navigate,
  rowRefs,
  onRowClick,
  emojiTargeting,
  emojiPops,
  emojiAllowedIds,
  alliances,
  allianceStates,
  allianceCellRefs,
  onAllianceCellClick,
  allianceCooldownIds,
  storedGameId,
  endedAt,
  conductFriends,
  conductBlockedUserIds,
  onConductChange,
  anonymous,
  recoloredIds,
  onCycleColor,
}: Props) {
  const isSpectator = spectators.some((s) => s.id === selfId);
  const self = players.find((p) => p.id === selfId);
  const canSendEmoji = !!self && !connector.isOffline();
  const canSurrender =
    !gameEnded &&
    !connector.isTutorial() &&
    !isSpectator &&
    !!self &&
    !self.eliminated &&
    !self.surrendered;
  const canOfferDraw = canSurrender && !earlyWin && drawOffersOpen;
  const drawOffered = selfId !== null && drawVoteIds.includes(selfId);
  const canAbort = canSurrender && abortOpen;
  const abortProposed = selfId !== null && abortVoteIds.includes(selfId);
  const canLeave =
    isSpectator ||
    (!!self && (gameEnded || self.surrendered || self.eliminated));
  const canControl =
    !gameEnded &&
    !connector.isTutorial() &&
    (selfId === hostId || connector.isOffline());
  const canRestart = !gameEnded && connector.canRestart(players);
  const canPause =
    canControl && (connector.isOffline() || paused || !pauseUsed);
  const hasLivingBot = players.some((p) => p.isBot && !p.eliminated);
  const showAllianceColumn = alliances === 'on' && !isSpectator && !gameEnded;
  const totalCapitals = players.reduce((sum, p) => sum + p.capitalCount, 0);
  const contenders = players.filter((p) => !p.eliminated && !p.surrendered);
  const leaderCapitals = Math.max(0, ...contenders.map((p) => p.capitalCount));
  const showPoints = isPointsMode(gameMode);
  const leaderPoints = Math.max(0, ...contenders.map((p) => p.points));
  const territoryCounts = contenders.map((p) => p.territoryCount);
  const leaderTerritories = territoryCounts.every((count) => count !== null)
    ? Math.max(0, ...territoryCounts.map((count) => count ?? 0))
    : leaderTerritoryCount;

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const collapse = () => {
    setSelectedId(null);
    setCollapsed(true);
  };
  useDismissOnOutsideClick(!collapsed, panelRef, collapse);
  const [, bumpConductVersion] = useReducer((c: number) => c + 1, 0);
  const conduct = panelConduct(
    players,
    selfId,
    storedGameId,
    endedAt,
    gameEnded,
    anonymous,
  );
  const level = levelFor(players.length);
  const stats = statDefs({
    isTeamDeathmatch,
    isCapitals,
    showPoints,
    showBounties: bounties === 'on',
    showCards: cards !== 'off',
  });
  const singleColumnFits = useSingleColumnFit(
    level === 'chips' && !collapsed,
    panelRef,
    scrollRef,
    gridRef,
  );
  const selectedPlayer = players.find((p) => p.id === selectedId);
  const live = storedGameId === undefined;
  const closeDetails = () => setSelectedId(null);
  const selectPlayer = (playerId: number) =>
    setSelectedId((prev) => (prev === playerId ? null : playerId));

  const whiteTargetIcon = useWhiteIcon('/icons/target.svg');
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');

  if (collapsed) {
    return (
      <Tip text="Show players and actions" placement="left">
        <Button
          variant="secondary"
          size="sm"
          className="position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28, padding: 0 }}
          onClick={() => setCollapsed(false)}
        >
          <WhiteIcon path="/icons/menu.svg" alt="Menu" />
        </Button>
      </Tip>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`position-absolute top-0 end-0 ${PANEL_BG_CLASS} ${PANEL_CLASS} m-3 d-flex flex-column`}
      style={{
        maxHeight: 'calc(100vh - 2rem)',
        width: 'max-content',
      }}
    >
      <style>{`
        @keyframes annexEmojiHighlight {
          0% { filter: brightness(1); }
          20% { filter: brightness(1.6); }
          100% { filter: brightness(1); }
        }
        @keyframes annexEmojiHighlightAlt {
          0% { filter: brightness(1); }
          20% { filter: brightness(1.6); }
          100% { filter: brightness(1); }
        }
      `}</style>
      <div
        role="button"
        tabIndex={0}
        onClick={collapse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') collapse();
        }}
      >
        <div className="d-flex align-items-center justify-content-center gap-1 mb-1 fw-bold">
          <span>{titleCase(gameMode)}</span>
          {mission && (
            <Tip
              text={
                <>
                  Your mission:{' '}
                  {formatMission(mission, players, continentNames)}
                </>
              }
            >
              <img
                src={whiteTargetIcon ?? '/icons/target.svg'}
                width={14}
                height={14}
                alt="Your mission"
                style={{ cursor: 'help' }}
              />
            </Tip>
          )}
        </div>
        <div className="text-center fw-bold mb-3">
          Round{' '}
          {['territory', 'troop', 'capital'].includes(turnPhase)
            ? 0
            : roundNumber + 1}
        </div>
      </div>
      {starvation === 'territory' && (
        <div className="text-center small mb-2">
          Territory troops cap: {territoryTroopsCap}
        </div>
      )}
      {starvation === 'total' && (
        <div className="text-center small mb-2">
          Total troops cap: {totalTroopsCap}
        </div>
      )}
      {isCapitals && (
        <div className="text-center small mb-2">
          Leader {leaderCapitals}/{totalCapitals}
        </div>
      )}
      {showPoints && (
        <div className="text-center small mb-2">
          Leader {leaderPoints}/{maxPoints}
        </div>
      )}
      {leaderTerritoryCount !== null && (
        <div className="text-center small mb-2">
          Leader {leaderTerritories}/{territoriesToWin}
        </div>
      )}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{ overflowY: 'auto', minHeight: 0 }}
        onWheel={(e) => e.stopPropagation()}
      >
        <PlayersRoster
          players={players}
          level={level}
          twoColumns={level === 'chips' && !singleColumnFits}
          gridRef={gridRef}
          stats={stats}
          progressContext={{
            isCapitals,
            totalCapitals,
            showPoints,
            maxPoints,
            territoriesToWin,
          }}
          isTeamDeathmatch={isTeamDeathmatch}
          selfId={selfId}
          turnPlayerId={turnPlayerId}
          selectedId={selectedId}
          drawVoteIds={drawVoteIds}
          abortVoteIds={abortVoteIds}
          recoloredIds={recoloredIds}
          anonymous={anonymous}
          live={live}
          canSendEmoji={canSendEmoji}
          emojiTargeting={emojiTargeting}
          emojiPops={emojiPops}
          emojiAllowedIds={emojiAllowedIds}
          showAllianceColumn={showAllianceColumn}
          allianceStates={allianceStates}
          allianceCooldownIds={allianceCooldownIds}
          allianceCellRefs={allianceCellRefs}
          onAllianceCellClick={onAllianceCellClick}
          rowRefs={rowRefs}
          onSelect={selectPlayer}
          onEmojiClick={onRowClick}
        />
        {(canSendEmoji || toxins !== 'off') && (
          <div className="d-flex align-items-center mt-1">
            {canSendEmoji && (
              <Tip text="Send an emoji to everyone" placement="bottom">
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-inline-flex align-items-center justify-content-center"
                  style={{ width: 28, height: 28, padding: 0 }}
                  disabled={emojiTargeting}
                  onClick={() => onRowClick(GLOBAL_TARGET_ID)}
                  ref={(el: HTMLButtonElement | null) =>
                    registerRef(rowRefs, GLOBAL_TARGET_ID, el)
                  }
                >
                  <img
                    src={whiteGlobeIcon ?? '/icons/globe.svg'}
                    width={14}
                    height={14}
                    alt="Everyone"
                  />
                </Button>
              </Tip>
            )}
            {toxins !== 'off' && (
              <span className="small ms-auto">Toxins cost: {toxinsCost}</span>
            )}
          </div>
        )}
        {spectators.length > 0 && (
          <>
            <div className="fw-bold mt-2 mb-1">Spectators</div>
            <ListGroup variant="flush">
              {spectators.map((s) => (
                <ListGroup.Item
                  key={s.id}
                  className="py-1 d-flex align-items-center gap-1"
                >
                  <RankIcon elo={s.elo} />
                  <Flag country={s.country} />
                  {s.name}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}
        <PlayerActions
          paused={paused}
          botSpeed={botSpeed}
          canPause={canPause}
          canControl={canControl}
          hasLivingBot={hasLivingBot}
          canSurrender={canSurrender}
          canLeave={canLeave}
          earlyWin={earlyWin}
          canOfferDraw={canOfferDraw}
          drawOffered={drawOffered}
          canAbort={canAbort}
          abortProposed={abortProposed}
          canRestart={canRestart}
          onTogglePause={onTogglePause}
          onCycleBotSpeed={onCycleBotSpeed}
          onEndGame={onEndGame}
          onToggleDraw={onToggleDraw}
          onToggleAbort={onToggleAbort}
          onSurrender={onSurrender}
          navigate={navigate}
        />
      </div>
      {selectedPlayer && (
        <PlayerDetailsPopover
          key={selectedPlayer.id}
          player={selectedPlayer}
          name={selectedPlayer.id === selfId ? 'You' : selectedPlayer.name}
          live={live}
          conduct={conduct}
          friends={conductFriends}
          blockedUserIds={conductBlockedUserIds}
          onChange={() => {
            bumpConductVersion();
            onConductChange?.();
          }}
          onCycleColor={onCycleColor && (() => onCycleColor(selectedPlayer.id))}
          stats={stats}
          statuses={playerStatuses({
            player: selectedPlayer,
            isSelf: selectedPlayer.id === selfId,
            recolored: !!recoloredIds?.has(selectedPlayer.id),
            drawVoted: drawVoteIds.includes(selectedPlayer.id),
            abortVoted: abortVoteIds.includes(selectedPlayer.id),
          })}
          panelRef={panelRef}
          scrollRef={scrollRef}
          avoidPicker={
            canSendEmoji &&
            !selectedPlayer.isBot &&
            selectedPlayer.id !== selfId &&
            (emojiAllowedIds === null || emojiAllowedIds.has(selectedPlayer.id))
          }
          rowRefs={rowRefs}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}

export default memo(PlayersPanel);
