import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import Tip from '../../common/Tip';
import { useWhiteIcon } from '../../common/icon';
import { connector } from '../../connector';
import { contrastTextColor, withAlpha } from '../../lib/palette';
import type { Ack, GameState, TurnPhase } from '../../lib/types';

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

interface TankSpark {
  angle: number;
  length: number;
  distance: number;
  delay: number;
  duration: number;
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

interface Props {
  turnPhase: TurnPhase;
  currentPlayerName: string;
  color: string;
  isMyTurn: boolean;
  troopsToDeploy: number;
  troopsRemaining: number;
  canLeaveDeploy: boolean;
  paused: boolean;
  setGame: (game: GameState) => void;
  endsTurn: boolean;
  tankFireId: number;
}

function TurnPanel({
  turnPhase,
  currentPlayerName,
  color,
  isMyTurn,
  troopsToDeploy,
  troopsRemaining,
  canLeaveDeploy,
  paused,
  setGame,
  endsTurn,
  tankFireId,
}: Props) {
  const isDark = contrastTextColor(color) === '#ffffff';
  const whiteTankIcon = useWhiteIcon('/icons/tank.svg');
  const attackTankRef = useRef<HTMLImageElement>(null);
  const prevTankFireIdRef = useRef(tankFireId);
  const [bursts, setBursts] = useState<{ id: number; sparks: TankSpark[] }[]>(
    [],
  );

  useLayoutEffect(() => {
    if (tankFireId === prevTankFireIdRef.current) return;
    prevTankFireIdRef.current = tankFireId;
    const el = attackTankRef.current;
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = 'annexTankFire 0.35s ease-out';
    setBursts((prev) => [
      ...prev,
      { id: tankFireId, sparks: makeTankSparks() },
    ]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== tankFireId));
    }, TANK_BURST_DURATION);
  }, [tankFireId]);

  function nextPhase() {
    connector.nextPhase((res: Ack) => {
      if (res.ok) setGame(res.game);
    });
  }

  return (
    <div
      className="position-fixed bottom-0 start-50 translate-middle-x m-3 py-2 px-3 border rounded d-flex align-items-center gap-2"
      data-no-click-sound
      style={{
        zIndex: 1,
        backgroundColor: withAlpha(color, 0.75),
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
      `}</style>
      <span>{isMyTurn ? 'You' : currentPlayerName}</span>
      <span className="text-capitalize fw-bold" style={{ fontSize: '1.4em' }}>
        {turnPhase}
      </span>
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
      {isMyTurn &&
        !paused &&
        turnPhase !== 'territory' &&
        turnPhase !== 'troop' &&
        turnPhase !== 'capital' &&
        (turnPhase !== 'deploy' || canLeaveDeploy) && (
          <Button size="sm" onClick={nextPhase}>
            {endsTurn ? 'End Turn' : 'Next Phase'}
          </Button>
        )}
      {turnPhase === 'attack' && (
        <span
          className="position-relative d-inline-block ms-auto"
          style={{ width: 20, height: 20 }}
        >
          <img
            ref={attackTankRef}
            src={
              isDark ? (whiteTankIcon ?? '/icons/tank.svg') : '/icons/tank.svg'
            }
            width={20}
            height={20}
            alt="Attack"
            style={{ display: 'block', transformOrigin: '20% 100%' }}
          />
          {bursts.map((burst) => (
            <span
              key={burst.id}
              className="position-absolute"
              style={{
                left: '95%',
                top: '25%',
                width: 0,
                height: 0,
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
                      animation: `annexTankSpark ${spark.duration}ms linear ${spark.delay}ms both`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default TurnPanel;
