import PanelHeader from '../../common/PanelHeader';
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
      <PanelHeader title="Settings" onClose={onClose} />
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
          generateMap={() => {}}
          collapsible={false}
        />
      </div>
    </div>
  );
}

export default GameSettingsPanel;
