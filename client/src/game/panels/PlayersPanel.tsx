import type { MutableRefObject, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button, ListGroup, Table } from 'react-bootstrap';
import Tip from '../../common/Tip';
import { useWhiteIcon } from '../../common/icon';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import { contrastTextColor, playerColor } from '../../lib/palette';
import type {
  Bounties,
  GameMode,
  GameState,
  Mission,
  Starvation,
  Toxins,
  TurnPhase,
} from '../../lib/types';
import { EMOJI_POP_DURATION, GLOBAL_TARGET_ID, type EmojiPop } from '../emoji';

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function formatMission(
  mission: Mission,
  players: GameState['players'],
): ReactNode {
  if (mission.type === 'territories') {
    const percent = Math.round(mission.fraction * 100);
    return mission.minTroopsPerTerritory >= 2
      ? `Occupy ${percent}%+ of the territories, with ${mission.minTroopsPerTerritory}+ troops each.`
      : `Occupy ${percent}%+ of the territories.`;
  }
  if (mission.type === 'continents') {
    const names = formatList(mission.continentIds.map((id) => `#${id + 1}`));
    return `Conquer continents ${names}.`;
  }
  const target = players.find((p) => p.id === mission.targetId);
  return (
    <>
      Eliminate{' '}
      <span style={{ color: target ? playerColor(target.color) : undefined }}>
        {target?.name ?? 'your target'}
      </span>
      . If someone beats you to it, control 75%+ of the territories instead.
    </>
  );
}

interface Props {
  players: GameState['players'];
  spectators: GameState['spectators'];
  gameMode: GameMode;
  isTeamDeathmatch: boolean;
  isCapitals: boolean;
  starvation: Starvation;
  bounties: Bounties;
  territoryTroopsCap: number;
  totalTroopsCap: number;
  toxins: Toxins;
  toxinsCost: number;
  mission: Mission | null;
  selfId: number | null;
  hostId: number;
  paused: boolean;
  onTogglePause: () => void;
  onSurrender: () => void;
  turnNumber: number;
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
}

function PlayersPanel({
  players,
  spectators,
  gameMode,
  isTeamDeathmatch,
  isCapitals,
  starvation,
  bounties,
  territoryTroopsCap,
  totalTroopsCap,
  toxins,
  toxinsCost,
  mission,
  selfId,
  hostId,
  paused,
  onTogglePause,
  onSurrender,
  turnNumber,
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
}: Props) {
  const isSpectator = spectators.some((s) => s.id === selfId);
  const self = players.find((p) => p.id === selfId);
  const canSendEmoji = !!self;
  const canSurrender =
    !gameEnded &&
    !isSpectator &&
    !!self &&
    !self.eliminated &&
    !self.surrendered;
  const canLeave = isSpectator || (!!self && (gameEnded || self.surrendered));
  const isHost = !gameEnded && selfId === hostId;

  const whiteTeamIcon = useWhiteIcon('/icons/team.svg');
  const whiteTerritoryIcon = useWhiteIcon('/icons/territory.svg');
  const whiteCapitalIcon = useWhiteIcon('/icons/capital.svg');
  const whiteBountyIcon = useWhiteIcon('/icons/bounty.svg');
  const whiteTankIcon = useWhiteIcon('/icons/tank.svg');
  const whiteCardsIcon = useWhiteIcon('/icons/cards.svg');
  const whiteNoWifiIcon = useWhiteIcon('/icons/no-wifi.svg');
  const whiteFlagIcon = useWhiteIcon('/icons/flag.svg');
  const whiteDeathIcon = useWhiteIcon('/icons/death.svg');
  const whiteTargetIcon = useWhiteIcon('/icons/target.svg');
  const whitePauseIcon = useWhiteIcon('/icons/pause.svg');
  const whitePlayIcon = useWhiteIcon('/icons/play.svg');
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');
  const whiteFullscreenIcon = useWhiteIcon('/icons/fullscreen.svg');
  const whiteNotFullscreenIcon = useWhiteIcon('/icons/not_fullscreen.svg');

  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement,
  );

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', isFullscreen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [isFullscreen]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  if (collapsed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="position-absolute top-0 end-0 m-3"
        onClick={() => setCollapsed(false)}
      >
        ☰
      </Button>
    );
  }

  return (
    <div
      className={`position-absolute top-0 end-0 ${PANEL_BG_CLASS} ${PANEL_CLASS} m-3`}
      style={{
        width:
          270 +
          (isTeamDeathmatch ? 40 : 0) +
          (isCapitals ? 40 : 0) +
          (bounties === 'on' ? 40 : 0),
        maxHeight: 'calc(100vh - 2rem)',
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
        onClick={() => setCollapsed(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed(true);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div
          className="d-flex align-items-center justify-content-center gap-1 mb-1 fw-bold"
          style={{ position: 'relative' }}
        >
          <span>{gameMode}</span>
          {mission && (
            <Tip text={<>Your mission: {formatMission(mission, players)}</>}>
              <img
                src={whiteTargetIcon ?? '/icons/target.svg'}
                width={14}
                height={14}
                alt="Your mission"
                style={{ cursor: 'help' }}
              />
            </Tip>
          )}
          <Tip text={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            <Button
              variant="secondary"
              size="sm"
              className="d-flex align-items-center justify-content-center"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
            >
              <img
                src={
                  isFullscreen
                    ? (whiteNotFullscreenIcon ?? '/icons/not_fullscreen.svg')
                    : (whiteFullscreenIcon ?? '/icons/fullscreen.svg')
                }
                width={14}
                height={14}
                alt={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              />
            </Button>
          </Tip>
        </div>
        <div className="text-center fw-bold mb-3">
          Turn{' '}
          {['territory', 'troop', 'capital'].includes(turnPhase)
            ? 0
            : turnNumber + 1}
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
      <div
        className="overflow-auto no-scrollbar"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        <Table
          size="sm"
          borderless
          className="mb-0"
          style={{ tableLayout: 'fixed', width: '100%' }}
        >
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              <th>Player</th>
              {isTeamDeathmatch && (
                <th className="text-center" style={{ width: 34 }}>
                  <Tip text="Team">
                    <img
                      src={whiteTeamIcon ?? '/icons/team.svg'}
                      width={14}
                      height={14}
                      alt="Team"
                      className="align-middle"
                    />
                  </Tip>
                </th>
              )}
              <th className="text-center" style={{ width: 34 }}>
                <Tip text="Territories">
                  <img
                    src={whiteTerritoryIcon ?? '/icons/territory.svg'}
                    width={14}
                    height={14}
                    alt="Territories"
                    className="align-middle"
                  />
                </Tip>
              </th>
              {isCapitals && (
                <th className="text-center" style={{ width: 34 }}>
                  <Tip text="Capitals">
                    <img
                      src={whiteCapitalIcon ?? '/icons/capital.svg'}
                      width={14}
                      height={14}
                      alt="Capitals"
                      className="align-middle"
                    />
                  </Tip>
                </th>
              )}
              {bounties === 'on' && (
                <th className="text-center" style={{ width: 34 }}>
                  <Tip text="Bounties">
                    <img
                      src={whiteBountyIcon ?? '/icons/bounty.svg'}
                      width={14}
                      height={14}
                      alt="Bounties"
                      className="align-middle"
                    />
                  </Tip>
                </th>
              )}
              <th className="text-center" style={{ width: 34 }}>
                <Tip text="Troops">
                  <img
                    src={whiteTankIcon ?? '/icons/tank.svg'}
                    width={14}
                    height={14}
                    alt="Troops"
                    className="align-middle"
                  />
                </Tip>
              </th>
              <th className="text-center" style={{ width: 34 }}>
                <Tip text="Cards">
                  <img
                    src={whiteCardsIcon ?? '/icons/cards.svg'}
                    width={14}
                    height={14}
                    alt="Cards"
                    className="align-middle"
                  />
                </Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const bg = playerColor(p.color);
              const fg = contrastTextColor(bg);
              const rowStyle = { backgroundColor: bg, color: fg };
              const isDark = fg === '#ffffff';
              const isConnected = p.connected;
              const pop = emojiPops.find((e) => e.rowPlayerId === p.id);
              const rowClickable =
                canSendEmoji && (emojiTargeting || p.id !== selfId);
              return (
                <tr
                  key={p.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(p.id, el);
                    else rowRefs.current.delete(p.id);
                  }}
                  role={rowClickable ? 'button' : undefined}
                  data-no-click-sound
                  onClick={() => rowClickable && onRowClick(p.id)}
                  style={{
                    cursor: rowClickable
                      ? emojiTargeting
                        ? 'crosshair'
                        : 'pointer'
                      : undefined,
                    animation: pop
                      ? `annexEmojiHighlight${pop.id % 2 === 0 ? '' : 'Alt'} ${EMOJI_POP_DURATION}ms ease-out forwards`
                      : undefined,
                    outline: p.id === selfId ? '2px solid #fff' : undefined,
                    outlineOffset: p.id === selfId ? '-2px' : undefined,
                  }}
                >
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.id === turnPlayerId && '●'}
                  </td>
                  <td className="align-middle" style={rowStyle}>
                    <div className="d-flex align-items-center gap-1">
                      <span className="text-truncate" style={{ minWidth: 0 }}>
                        {p.id === selfId ? 'You' : p.name}
                      </span>
                      {p.eliminated && (
                        <Tip text="Eliminated">
                          <img
                            src={
                              isDark
                                ? (whiteDeathIcon ?? '/icons/death.svg')
                                : '/icons/death.svg'
                            }
                            width={12}
                            height={12}
                            alt="Eliminated"
                            className="flex-shrink-0"
                          />
                        </Tip>
                      )}
                      {p.surrendered && (
                        <Tip text="Surrendered">
                          <img
                            src={
                              isDark
                                ? (whiteFlagIcon ?? '/icons/flag.svg')
                                : '/icons/flag.svg'
                            }
                            width={12}
                            height={12}
                            alt="Surrendered"
                            className="flex-shrink-0"
                          />
                        </Tip>
                      )}
                      {!isConnected && !p.eliminated && (
                        <Tip text="Disconnected">
                          <img
                            src={
                              isDark
                                ? (whiteNoWifiIcon ?? '/icons/no-wifi.svg')
                                : '/icons/no-wifi.svg'
                            }
                            width={12}
                            height={12}
                            alt="Disconnected"
                            className="flex-shrink-0"
                          />
                        </Tip>
                      )}
                    </div>
                  </td>
                  {isTeamDeathmatch && (
                    <td className="align-middle text-center" style={rowStyle}>
                      {p.team + 1}
                    </td>
                  )}
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.territoryCount ?? '?'}
                  </td>
                  {isCapitals && (
                    <td className="align-middle text-center" style={rowStyle}>
                      {p.capitalCount}
                    </td>
                  )}
                  {bounties === 'on' && (
                    <td className="align-middle text-center" style={rowStyle}>
                      {p.playersKilled.length}
                    </td>
                  )}
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.troopCount ?? '?'}
                  </td>
                  <td className="align-middle text-center" style={rowStyle}>
                    {p.cardCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {(canSendEmoji || toxins !== 'off') && (
          <div className="d-flex align-items-center mt-1">
            {canSendEmoji && (
              <Tip text="Everyone" placement="bottom">
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-inline-flex align-items-center justify-content-center"
                  style={{ width: 28, height: 28, padding: 0 }}
                  disabled={emojiTargeting}
                  onClick={() => onRowClick(GLOBAL_TARGET_ID)}
                  ref={(el) => {
                    if (el) rowRefs.current.set(GLOBAL_TARGET_ID, el);
                    else rowRefs.current.delete(GLOBAL_TARGET_ID);
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
                <ListGroup.Item key={s.id} className="py-1">
                  {s.name}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}
      </div>
      {(isHost || canSurrender) && (
        <div
          className={`d-flex mt-2 ${isHost && canSurrender ? 'justify-content-between' : 'justify-content-end'}`}
        >
          {isHost && (
            <Button
              variant="secondary"
              size="sm"
              className="d-flex align-items-center gap-1"
              onClick={onTogglePause}
            >
              <img
                src={
                  paused
                    ? (whitePlayIcon ?? '/icons/play.svg')
                    : (whitePauseIcon ?? '/icons/pause.svg')
                }
                width={14}
                height={14}
                alt=""
              />
              {paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          {canSurrender && (
            <Button
              variant="danger"
              size="sm"
              className="d-flex align-items-center gap-1"
              onClick={onSurrender}
            >
              <img
                src={whiteFlagIcon ?? '/icons/flag.svg'}
                width={14}
                height={14}
                alt=""
              />
              Surrender
            </Button>
          )}
        </div>
      )}
      {canLeave && (
        <div className="d-flex justify-content-end mt-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            Leave
          </Button>
        </div>
      )}
    </div>
  );
}

export default PlayersPanel;
