import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useWhiteIcon } from '../../common/icon';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Tip from '../../common/tooltips/Tip';
import { connector } from '../../connector';
import { contrastTextColor } from '../../lib/palette';
import type { TurnPhase } from '../../lib/types';

const SPARK_BASE_ANGLES = [-50, -35, -20, -7, 7, 20, 35, 50];
const SPARK_ANGLE_JITTER = 7;
const SPARK_LENGTH_MIN = 4;
const SPARK_LENGTH_RANGE = 4;
const SPARK_DISTANCE_MIN = 7;
const SPARK_DISTANCE_RANGE = 6;
const SPARK_DELAY_MAX = 40;
const SPARK_DURATION_MIN = 120;
const SPARK_DURATION_RANGE = 70;
const TANK_BURST_DURATION = 320;
const TANK_SIZE = 20;
const SQUAD_TANK_SIZE = 10;
const SQUAD_DURATION = 950;
const SQUAD_FIRE_DELAY = 150;
const SQUAD_FIRE_STAGGER = 120;
const SQUAD_MAX_TANKS = 3;

interface SquadTank {
  x: number;
  y: number;
}

const SQUAD_LAYOUTS: Record<number, SquadTank[]> = {
  1: [{ x: 5, y: 5 }],
  2: [
    { x: -1, y: 5 },
    { x: 10, y: 5 },
  ],
  3: [
    { x: -1, y: 10 },
    { x: 10, y: 10 },
    { x: 4.5, y: 0 },
  ],
};
const SQUAD_OVERFLOW_LAYOUT: SquadTank[] = [{ x: -1, y: 5 }];

interface TankSpark {
  angle: number;
  length: number;
  distance: number;
  delay: number;
  duration: number;
}

interface TankBurst {
  left: number;
  top: number;
  scale: number;
  delay: number;
  sparks: TankSpark[];
}

interface TankVolley {
  id: number;
  dice?: number;
  bursts: TankBurst[];
}

function makeTankSparks(): TankSpark[] {
  return SPARK_BASE_ANGLES.map((angle) => ({
    angle: angle + (Math.random() * 2 - 1) * SPARK_ANGLE_JITTER,
    length: SPARK_LENGTH_MIN + Math.random() * SPARK_LENGTH_RANGE,
    distance: SPARK_DISTANCE_MIN + Math.random() * SPARK_DISTANCE_RANGE,
    delay: Math.random() * SPARK_DELAY_MAX,
    duration: SPARK_DURATION_MIN + Math.random() * SPARK_DURATION_RANGE,
  }));
}

function squadLayout(dice: number): SquadTank[] {
  return dice > SQUAD_MAX_TANKS ? SQUAD_OVERFLOW_LAYOUT : SQUAD_LAYOUTS[dice];
}

function muzzleBurst(
  x: number,
  y: number,
  size: number,
  delay: number,
): TankBurst {
  return {
    left: x + size * 0.95,
    top: y + size * 0.25,
    scale: size / TANK_SIZE,
    delay,
    sparks: makeTankSparks(),
  };
}

function makeVolley(id: number, dice?: number): TankVolley {
  if (dice === undefined)
    return { id, bursts: [muzzleBurst(0, 0, TANK_SIZE, 0)] };
  return {
    id,
    dice,
    bursts: squadLayout(dice).map((tank, i) =>
      muzzleBurst(
        tank.x,
        tank.y,
        SQUAD_TANK_SIZE,
        SQUAD_FIRE_DELAY + i * SQUAD_FIRE_STAGGER,
      ),
    ),
  };
}

interface Props {
  turnPhase: TurnPhase;
  currentPlayerName: string;
  color: string;
  isMyTurn: boolean;
  troopsToDeploy: number;
  troopsRemaining: number;
  capitalsPlaced: number;
  startingCapitals: number;
  canLeaveDeploy: boolean;
  paused: boolean;
  endsTurn: boolean;
  tankFire: { id: number; dice?: number };
  advancePhase: () => void;
  canReturnPhase: boolean;
  returnPhase: () => void;
}

function TurnPanel({
  turnPhase,
  currentPlayerName,
  color,
  isMyTurn,
  troopsToDeploy,
  troopsRemaining,
  capitalsPlaced,
  startingCapitals,
  canLeaveDeploy,
  paused,
  endsTurn,
  tankFire,
  advancePhase,
  canReturnPhase,
  returnPhase,
}: Props) {
  const isDark = contrastTextColor(color) === '#ffffff';
  const whiteTankIcon = useWhiteIcon('/icons/tank.svg');
  const tankIcon = isDark
    ? (whiteTankIcon ?? '/icons/tank.svg')
    : '/icons/tank.svg';
  const attackTankRef = useRef<HTMLImageElement>(null);
  const prevTankFireIdRef = useRef(tankFire.id);
  const [volleys, setVolleys] = useState<TankVolley[]>([]);

  useLayoutEffect(() => {
    if (tankFire.id === prevTankFireIdRef.current) return;
    prevTankFireIdRef.current = tankFire.id;
    const el = attackTankRef.current;
    if (!el) return;
    const manual = tankFire.dice !== undefined;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = manual
      ? `annexTankSquadHide ${SQUAD_DURATION}ms linear`
      : 'annexTankFire 0.35s ease-out';
    const volley = makeVolley(tankFire.id, tankFire.dice);
    setVolleys((prev) => [...prev, volley]);
    setTimeout(
      () => {
        setVolleys((prev) => prev.filter((v) => v.id !== volley.id));
      },
      manual ? SQUAD_DURATION : TANK_BURST_DURATION,
    );
  }, [tankFire]);

  return (
    <div
      className="position-fixed bottom-0 start-50 translate-middle-x m-3 py-2 px-3 border rounded d-flex align-items-center gap-2"
      data-no-click-sound
      style={{
        zIndex: 1,
        backgroundColor: color,
        color: contrastTextColor(color),
      }}
    >
      <style>{`
        @keyframes annexTankFire {
          0% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(-4px) rotate(-9deg); }
          55% { transform: translateX(1px) rotate(3deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes annexTankSpark {
          0% { transform: rotate(var(--annex-spark-angle)) translateX(0) scaleX(0.15); opacity: 1; }
          20% { transform: rotate(var(--annex-spark-angle)) translateX(1px) scaleX(1); opacity: 1; }
          100% { transform: rotate(var(--annex-spark-angle)) translateX(var(--annex-spark-distance)) scaleX(0.5); opacity: 0; }
        }
        @keyframes annexTankSquadHide {
          0% { opacity: 1; }
          10% { opacity: 0; }
          88% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes annexTankSquad {
          0% { transform: scale(0); opacity: 0; }
          14% { transform: scale(1); opacity: 1; }
          85% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
      `}</style>
      <span>{isMyTurn ? 'You' : currentPlayerName}</span>
      <span className="text-capitalize fw-bold" style={{ fontSize: '1.4em' }}>
        {turnPhase}
      </span>
      {turnPhase === 'capital' && startingCapitals > 1 && (
        <span>
          {capitalsPlaced + 1}/{startingCapitals}
        </span>
      )}
      {(turnPhase === 'deploy' || turnPhase === 'troop') && (
        <span className="d-flex align-items-center gap-1">
          {turnPhase === 'troop' && (
            <Tip text="Troops to place">
              <img
                src={
                  isDark
                    ? (whiteTankIcon ?? '/icons/tank.svg')
                    : '/icons/tank.svg'
                }
                width={14}
                height={14}
                alt="Troops to place"
              />
            </Tip>
          )}
          {turnPhase === 'troop'
            ? `${troopsToDeploy}/${troopsRemaining}`
            : troopsToDeploy}
        </span>
      )}
      {canReturnPhase && (
        <Tip text="Previous phase">
          <Button
            className="d-flex align-items-center justify-content-center"
            size="sm"
            variant="secondary"
            onClick={returnPhase}
          >
            <WhiteIcon path="/icons/undo.svg" size={14} alt="Previous phase" />
          </Button>
        </Tip>
      )}
      {isMyTurn &&
        !paused &&
        connector.tutorialAllows('game:nextPhase') &&
        turnPhase !== 'territory' &&
        turnPhase !== 'troop' &&
        turnPhase !== 'capital' &&
        (turnPhase !== 'deploy' || canLeaveDeploy) && (
          <Tip text={endsTurn ? 'End your turn' : 'Move to the next phase'}>
            <Button
              size="sm"
              className="d-flex align-items-center gap-1"
              onClick={advancePhase}
            >
              <WhiteIcon
                path={endsTurn ? '/icons/exit.svg' : '/icons/skip-forward.svg'}
                size={14}
              />
              {endsTurn ? 'End Turn' : 'Next Phase'}
            </Button>
          </Tip>
        )}
      {turnPhase === 'attack' && (
        <span
          className="position-relative d-inline-block ms-auto"
          style={{ width: 20, height: 20 }}
        >
          <img
            ref={attackTankRef}
            src={tankIcon}
            width={TANK_SIZE}
            height={TANK_SIZE}
            alt="Attack"
            style={{ display: 'block', transformOrigin: '20% 100%' }}
          />
          {volleys.map(
            (volley) =>
              volley.dice !== undefined && (
                <span key={volley.id}>
                  {squadLayout(volley.dice).map((tank, i) => (
                    <span
                      key={i}
                      className="position-absolute"
                      style={{
                        left: tank.x,
                        top: tank.y,
                        transformOrigin: '50% 100%',
                        animation: `annexTankSquad ${SQUAD_DURATION}ms ease-out both`,
                        pointerEvents: 'none',
                      }}
                    >
                      <img
                        src={tankIcon}
                        width={SQUAD_TANK_SIZE}
                        height={SQUAD_TANK_SIZE}
                        alt=""
                        style={{
                          display: 'block',
                          transformOrigin: '20% 100%',
                          animation: `annexTankFire 0.3s ease-out ${volley.bursts[i].delay}ms`,
                        }}
                      />
                    </span>
                  ))}
                  {volley.dice > SQUAD_MAX_TANKS && (
                    <span
                      className="position-absolute fw-bold"
                      style={{
                        left: 10,
                        top: 5,
                        fontSize: 9,
                        lineHeight: `${SQUAD_TANK_SIZE}px`,
                        animation: `annexTankSquad ${SQUAD_DURATION}ms ease-out both`,
                        pointerEvents: 'none',
                      }}
                    >
                      ×{volley.dice}
                    </span>
                  )}
                </span>
              ),
          )}
          {volleys.flatMap((volley) =>
            volley.bursts.map((burst, i) => (
              <span
                key={`${volley.id}-${i}`}
                className="position-absolute"
                style={{
                  left: burst.left,
                  top: burst.top,
                  width: 0,
                  height: 0,
                  transform: `scale(${burst.scale})`,
                  pointerEvents: 'none',
                }}
              >
                {burst.sparks.map((spark, i) => (
                  <span
                    key={i}
                    className="position-absolute"
                    style={
                      {
                        left: 0,
                        top: 0,
                        width: spark.length,
                        height: 1.5,
                        backgroundColor: isDark ? '#ffffff' : '#000000',
                        transformOrigin: 'left center',
                        '--annex-spark-angle': `${spark.angle}deg`,
                        '--annex-spark-distance': `${spark.distance}px`,
                        animation: `annexTankSpark ${spark.duration}ms linear ${spark.delay + burst.delay}ms both`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            )),
          )}
        </span>
      )}
    </div>
  );
}

export default TurnPanel;
