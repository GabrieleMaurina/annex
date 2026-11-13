import { ONLINE_PAUSE_SECONDS } from 'engine';
import { Button } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import Tip from '../../../common/tooltips/Tip';
import { connector } from '../../../connector';
import type { BotSpeed } from '../../../lib/types';
import ButtonRows from '../../../ui/buttons/ButtonRows';

interface Props {
  paused: boolean;
  botSpeed: BotSpeed;
  canPause: boolean;
  canControl: boolean;
  hasLivingBot: boolean;
  canSurrender: boolean;
  canLeave: boolean;
  earlyWin: boolean;
  canOfferDraw: boolean;
  drawOffered: boolean;
  canAbort: boolean;
  abortProposed: boolean;
  canRestart: boolean;
  onTogglePause: () => void;
  onCycleBotSpeed: () => void;
  onEndGame: () => void;
  onToggleDraw: () => void;
  onToggleAbort: () => void;
  onSurrender: () => void;
  navigate: (path: string) => void;
}

const botSpeedLabel: Record<BotSpeed, string> = {
  slow: 'Bots: Slow',
  medium: 'Bots: Medium',
  fast: 'Bots: Fast',
};

const nextBotSpeedName: Record<BotSpeed, string> = {
  slow: 'Medium',
  medium: 'Fast',
  fast: 'Slow',
};

function PlayerActions({
  paused,
  botSpeed,
  canPause,
  canControl,
  hasLivingBot,
  canSurrender,
  canLeave,
  earlyWin,
  canOfferDraw,
  drawOffered,
  canAbort,
  abortProposed,
  canRestart,
  onTogglePause,
  onCycleBotSpeed,
  onEndGame,
  onToggleDraw,
  onToggleAbort,
  onSurrender,
  navigate,
}: Props) {
  return (
    <>
      {(canPause || (canControl && hasLivingBot)) && (
        <div className="mt-2">
          <ButtonRows>
            {canPause && (
              <Tip
                text={
                  paused
                    ? 'Resume game for everyone'
                    : connector.isOffline()
                      ? 'Pause game for everyone'
                      : `Pause game for everyone for up to ${ONLINE_PAUSE_SECONDS} seconds, once per game`
                }
                placement="bottom"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onTogglePause}
                >
                  <WhiteIcon
                    path={paused ? '/icons/play.svg' : '/icons/pause.svg'}
                    size={14}
                  />
                  {paused ? 'Resume' : 'Pause'}
                </Button>
              </Tip>
            )}
            {hasLivingBot && (
              <Tip
                text={`Change bots speed. Click for ${nextBotSpeedName[botSpeed]}`}
                placement="bottom"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onCycleBotSpeed}
                >
                  <WhiteIcon
                    path={
                      botSpeed === 'slow'
                        ? '/icons/stopwatch.svg'
                        : botSpeed === 'medium'
                          ? '/icons/step-forward.svg'
                          : '/icons/skip-forward.svg'
                    }
                    size={14}
                  />
                  {botSpeedLabel[botSpeed]}
                </Button>
              </Tip>
            )}
          </ButtonRows>
        </div>
      )}
      {(canSurrender || canLeave) && (
        <div className="mt-2">
          <ButtonRows>
            {canSurrender && earlyWin && (
              <Tip
                text="Your victory is locked in. End the game now or keep conquering for fun"
                placement="bottom"
              >
                <Button
                  variant="success"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onEndGame}
                >
                  <WhiteIcon path="/icons/trophy.svg" size={14} />
                  End game
                </Button>
              </Tip>
            )}
            {canOfferDraw && (
              <Tip
                text={
                  drawOffered
                    ? 'You offered a draw. It happens once every remaining human player offers one. Click to withdraw your offer'
                    : 'Offer a draw. The game ends in a draw once every remaining human player offers one'
                }
                placement="bottom"
              >
                <Button
                  variant={drawOffered ? 'success' : 'secondary'}
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onToggleDraw}
                >
                  <WhiteIcon path="/icons/draw.svg" size={14} />
                  Draw
                </Button>
              </Tip>
            )}
            {canAbort && (
              <Tip
                text={
                  abortProposed
                    ? 'You asked to abort. It happens once every human player asks. Click to withdraw your request'
                    : 'Abort the game without any penalty. Only available in the first round, and only if every human player asks for it'
                }
                placement="bottom"
              >
                <Button
                  variant={abortProposed ? 'success' : 'secondary'}
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onToggleAbort}
                >
                  <WhiteIcon path="/icons/close.svg" size={14} />
                  Abort
                </Button>
              </Tip>
            )}
            {canSurrender && !earlyWin && (
              <Tip text="Surrender the game" placement="bottom">
                <Button
                  variant="danger"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={onSurrender}
                >
                  <WhiteIcon path="/icons/flag.svg" size={14} />
                  Surrender
                </Button>
              </Tip>
            )}
            {canRestart && (
              <Tip
                text="Start a new game with the same settings, players and map"
                placement="bottom"
              >
                <Button
                  variant="success"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={() => connector.restart()}
                >
                  <WhiteIcon path="/icons/restart.svg" size={14} />
                  Restart
                </Button>
              </Tip>
            )}
            {canLeave && (
              <Tip text="Go back to home" placement="bottom">
                <Button
                  variant="secondary"
                  size="sm"
                  className="d-flex align-items-center justify-content-center gap-1"
                  onClick={() => navigate('/')}
                >
                  <WhiteIcon path="/icons/exit.svg" size={14} />
                  Leave
                </Button>
              </Tip>
            )}
          </ButtonRows>
        </div>
      )}
    </>
  );
}

export default PlayerActions;
