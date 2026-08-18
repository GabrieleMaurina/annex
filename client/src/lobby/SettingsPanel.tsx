import { Form } from 'react-bootstrap';
import type {
  Blitz,
  CardsMode,
  DefenceDice,
  GameMode,
  GameSettingsInput,
  GameState,
  TurnDuration,
} from '../types';

const TURN_DURATIONS: TurnDuration[] = [60, 90, 120, 150, 180, 300];

interface Props {
  game: GameState;
  isHost: boolean;
  mapNames: string[];
  applySettings: (settings: GameSettingsInput) => void;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
}

function SettingsPanel({ game, isHost, mapNames, applySettings }: Props) {
  return (
    <div style={{ maxWidth: 400 }}>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
        <Form.Label className="mb-0">Game Mode</Form.Label>
        {isHost ? (
          <Form.Select
            className="w-auto"
            value={game.gameMode}
            onChange={(e) =>
              applySettings({ gameMode: e.target.value as GameMode })
            }
          >
            <option value="World Domination">World Domination</option>
            <option value="Capital Conquest">Capital Conquest</option>
            <option value="Team Deathmatch">Team Deathmatch</option>
          </Form.Select>
        ) : (
          <span>{game.gameMode}</span>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
        <Form.Label className="mb-0">Map</Form.Label>
        {isHost ? (
          <Form.Select
            className="w-auto"
            value={game.mapName}
            onChange={(e) => applySettings({ mapName: e.target.value })}
          >
            {mapNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Form.Select>
        ) : (
          <span>{game.mapName}</span>
        )}
      </div>

      <details className="mb-3">
        <summary>Settings</summary>
        <div className="mt-2">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0">Blitz</Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.blitz}
                onChange={(e) =>
                  applySettings({
                    blitz: e.target.value as Blitz,
                  })
                }
              >
                <option value="Balanced">Balanced</option>
                <option value="True">True</option>
              </Form.Select>
            ) : (
              <span>{game.blitz}</span>
            )}
          </div>

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0">Defence Dice</Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.defenceDice}
                onChange={(e) =>
                  applySettings({
                    defenceDice: Number(e.target.value) as DefenceDice,
                  })
                }
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
              </Form.Select>
            ) : (
              <span>{game.defenceDice}</span>
            )}
          </div>

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0">Cards</Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.cards}
                onChange={(e) =>
                  applySettings({ cards: e.target.value as CardsMode })
                }
              >
                <option value="Fixed">Fixed</option>
                <option value="Progressive">Progressive</option>
                <option value="Exponential">Exponential</option>
              </Form.Select>
            ) : (
              <span>{game.cards}</span>
            )}
          </div>

          <div className="d-flex justify-content-between align-items-center gap-3 mb-2">
            <Form.Label className="mb-0">Turn Duration</Form.Label>
            {isHost ? (
              <Form.Select
                className="w-auto"
                value={game.turnDuration}
                onChange={(e) =>
                  applySettings({
                    turnDuration: Number(e.target.value) as TurnDuration,
                  })
                }
              >
                {TURN_DURATIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatDuration(seconds)}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <span>{formatDuration(game.turnDuration)}</span>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

export default SettingsPanel;
