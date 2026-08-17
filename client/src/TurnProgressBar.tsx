interface Props {
  turnKey: string;
  turnDuration: number;
  color: string;
}

function TurnProgressBar({ turnKey, turnDuration, color }: Props) {
  return (
    <div
      className="position-fixed top-0 start-0 end-0"
      style={{ height: 4, zIndex: 2 }}
    >
      <style>{`
        @keyframes annexTurnProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div
        key={turnKey}
        style={{
          height: '100%',
          width: '0%',
          backgroundColor: color,
          animation: `annexTurnProgress ${turnDuration}s linear forwards`,
        }}
      />
    </div>
  );
}

export default TurnProgressBar;
