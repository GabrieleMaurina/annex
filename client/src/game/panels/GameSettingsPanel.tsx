import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import type { GameState } from '../../lib/types';
import SettingsPanel from '../../lobby/SettingsPanel';

interface Props {
  game: GameState;
  top: number;
  onClose: () => void;
}

const BOTTOM_MARGIN = 72;

function GameSettingsPanel({ game, top, onClose }: Props) {
  return (
    <div
      className={`${PANEL_BG_CLASS} ${PANEL_CLASS} d-flex flex-column`}
      style={{
        width: 960,
        maxHeight: `calc(100vh - ${top}px - ${BOTTOM_MARGIN}px)`,
      }}
    >
      <div
        className="fw-bold lh-1 mb-2 flex-shrink-0"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onClose();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        Settings
      </div>
      <div
        className="no-scrollbar"
        style={{ overflowY: 'auto', minHeight: 0 }}
        onWheel={(e) => e.stopPropagation()}
      >
        <SettingsPanel
          game={game}
          isHost={false}
          mapNames={[]}
          applySettings={() => {}}
          collapsible={false}
        />
      </div>
    </div>
  );
}

export default GameSettingsPanel;
