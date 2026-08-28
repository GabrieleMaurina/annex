import { Badge, Button, Container, Table } from 'react-bootstrap';
import EmojiTableOverlay from '../common/emojiTable/EmojiTableOverlay';
import { useTableEmojiReactions } from '../common/emojiTable/useTableEmojiReactions';
import { useWhiteIcon } from '../common/icon';
import PlayerNameEditor from '../common/PlayerNameEditor';
import Tip from '../common/Tip';
import { GLOBAL_TARGET_ID } from '../game/logic/emoji';
import { contrastTextColor, playerColor } from '../lib/palette';
import type { GameState, Player, PlayerResultStats } from '../lib/types';
import SettingsPanel from '../lobby/SettingsPanel';

const EMPTY_STATS: Omit<PlayerResultStats, 'id'> = {
  troopsGained: 0,
  troopsKilled: 0,
  troopsLost: 0,
  territoriesConquered: 0,
  territoriesLost: 0,
  capitalsConquered: 0,
  capitalsLost: 0,
  cardsGained: 0,
  turnsPlayed: 0,
  setsPlayed: 0,
};

interface Props {
  game: GameState;
  results: Map<number, PlayerResultStats> | null;
  selfId: number | null;
  mapNames: string[];
  navigate: (path: string) => void;
  onViewMap: () => void;
  player: Player;
  onNameChange: (name: string) => void;
}

function EndPage({
  game,
  results,
  selfId,
  mapNames,
  navigate,
  onViewMap,
  player,
  onNameChange,
}: Props) {
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  const won = selfId !== null && game.winnerIds.includes(selfId);
  const isTeamDeathmatch = game.gameMode === 'Team Deathmatch';
  const isCapitals = game.gameMode === 'Capitals';
  const nameById = new Map(game.players.map((p) => [p.id, p.name]));
  const playerById = new Map(game.players.map((p) => [p.id, p]));
  const rankedPlayers = game.finalRanking
    .map((id) => playerById.get(id))
    .filter((p): p is GameState['players'][number] => !!p);

  const whiteBotIcon = useWhiteIcon('/icons/bot.svg');
  const whiteDeathIcon = useWhiteIcon('/icons/death.svg');
  const whiteNoWifiIcon = useWhiteIcon('/icons/no-wifi.svg');
  const whiteFlagIcon = useWhiteIcon('/icons/flag.svg');
  const whiteGlobeIcon = useWhiteIcon('/icons/globe.svg');

  const {
    emojiPickerFor,
    emojiPops,
    handleRowClick,
    handleEmojiPick,
    emojiPickerRef,
    rowRefs,
    nameCellRefs,
  } = useTableEmojiReactions(selfId);

  return (
    <Container fluid className="py-5 px-4">
      <div className="position-fixed top-0 end-0 m-3" style={{ zIndex: 1 }}>
        <PlayerNameEditor player={player} onNameChange={onNameChange} />
      </div>
      <div className="text-center mb-4">
        <h1 className="mb-4">{won ? 'You Win!' : 'Game Over'}</h1>
        {isTeamDeathmatch ? (
          <p className="fs-4 mb-0">
            Team {(winners[0]?.team ?? 0) + 1} wins:{' '}
            {winners.map((w) => w.name).join(', ')}
          </p>
        ) : (
          <p
            className="fs-4 mb-0"
            style={{ color: playerColor(winners[0]?.color ?? 0) }}
          >
            {winners[0]?.name} wins!
          </p>
        )}
      </div>

      <div className="table-responsive">
        <Table size="sm" borderless className="mb-0 text-center align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th className="text-start">Player</th>
              <th>Turns</th>
              <th>Players Killed</th>
              <th>Troops Gained</th>
              <th>Troops Killed</th>
              <th>Troops Lost</th>
              <th>Territories Conquered</th>
              <th>Territories Lost</th>
              {isCapitals && <th>Capitals Conquered</th>}
              {isCapitals && <th>Capitals Lost</th>}
              <th>Cards Gained</th>
              <th>Sets Played</th>
            </tr>
          </thead>
          <tbody>
            {rankedPlayers.map((p, index) => {
              const bg = playerColor(p.color);
              const fg = contrastTextColor(bg);
              const rowStyle = {
                backgroundColor: bg,
                color: fg,
                cursor: p.id === selfId ? 'default' : 'pointer',
              };
              const isDark = fg === '#ffffff';
              const killedNames = p.playersKilled
                .map((id) => nameById.get(id) ?? '?')
                .join(', ');
              const stats = results?.get(p.id) ?? EMPTY_STATS;
              return (
                <tr
                  key={p.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(p.id, el);
                  }}
                  role={p.id === selfId ? undefined : 'button'}
                  data-no-click-sound
                  onClick={() => handleRowClick(p.id)}
                  style={{
                    outline: p.id === selfId ? '2px solid #fff' : undefined,
                    outlineOffset: p.id === selfId ? '-2px' : undefined,
                  }}
                >
                  <td style={rowStyle}>{index + 1}</td>
                  <td className="text-start" style={rowStyle}>
                    <div
                      ref={(el) => {
                        if (el) nameCellRefs.current.set(p.id, el);
                      }}
                      className="d-inline-flex align-items-center gap-1"
                    >
                      {p.isBot && (
                        <img
                          src={
                            isDark
                              ? (whiteBotIcon ?? '/icons/bot.svg')
                              : '/icons/bot.svg'
                          }
                          width={12}
                          height={12}
                          alt="Bot"
                          className="flex-shrink-0"
                        />
                      )}
                      <span className="text-truncate" style={{ minWidth: 0 }}>
                        {p.id === selfId ? 'You' : p.name}
                      </span>
                      {p.id === game.originalHostId && (
                        <Badge bg="primary" className="flex-shrink-0">
                          Host
                        </Badge>
                      )}
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
                      {!p.connected && !p.eliminated && (
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
                  <td style={rowStyle}>
                    {stats.turnsPlayed}/{game.turnNumber + 1}
                  </td>
                  {killedNames ? (
                    <Tip text={killedNames}>
                      <td style={rowStyle}>{p.playersKilled.length}</td>
                    </Tip>
                  ) : (
                    <td style={rowStyle}>{p.playersKilled.length}</td>
                  )}
                  <td style={rowStyle}>{stats.troopsGained}</td>
                  <td style={rowStyle}>{stats.troopsKilled}</td>
                  <td style={rowStyle}>{stats.troopsLost}</td>
                  <td style={rowStyle}>{stats.territoriesConquered}</td>
                  <td style={rowStyle}>{stats.territoriesLost}</td>
                  {isCapitals && (
                    <td style={rowStyle}>{stats.capitalsConquered}</td>
                  )}
                  {isCapitals && <td style={rowStyle}>{stats.capitalsLost}</td>}
                  <td style={rowStyle}>{stats.cardsGained}</td>
                  <td style={rowStyle}>{stats.setsPlayed}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      <div className="d-flex justify-content-start mt-1 mb-4">
        <Tip text="Everyone" placement="bottom">
          <Button
            variant="secondary"
            size="sm"
            className="d-inline-flex align-items-center justify-content-center"
            style={{ width: 28, height: 28, padding: 0 }}
            onClick={() => handleRowClick(GLOBAL_TARGET_ID)}
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

      <EmojiTableOverlay
        emojiPickerFor={emojiPickerFor}
        emojiPops={emojiPops}
        rowRefs={rowRefs}
        nameCellRefs={nameCellRefs}
        emojiPickerRef={emojiPickerRef}
        onPick={handleEmojiPick}
      />

      <div className="d-flex justify-content-center gap-2">
        <Button variant="primary" onClick={onViewMap}>
          Map
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Leave
        </Button>
      </div>

      <div className="mt-4">
        <SettingsPanel
          game={game}
          isHost={false}
          mapNames={mapNames}
          applySettings={() => {}}
        />
      </div>
    </Container>
  );
}

export default EndPage;
