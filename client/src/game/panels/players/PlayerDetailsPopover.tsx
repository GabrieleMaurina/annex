import type { MutableRefObject, RefObject } from 'react';
import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { PanelConduct } from '../../../common/conduct/panelConduct';
import PanelPlayerDetails from '../../../common/conduct/PanelPlayerDetails';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import { playSound } from '../../../lib/sounds';
import type { FriendsOverview } from '../../../lib/types';
import { PANEL_BG_CLASS } from '../../../ui/containers/panelStyle';
import type { StatDef } from './playerStats';
import PlayerStatusIcons from './rows/PlayerStatusIcons';
import type { Player, PlayerStatus } from './rows/rowTypes';

const GAP = 8;
const PICKER_CLEARANCE = 24;

interface Props {
  player: Player;
  name: string;
  live: boolean;
  conduct: PanelConduct | null;
  friends?: FriendsOverview;
  blockedUserIds?: string[];
  onChange: () => void;
  onCycleColor?: () => void;
  stats: StatDef[];
  statuses: PlayerStatus[];
  panelRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  avoidPicker: boolean;
  rowRefs: MutableRefObject<Map<number, HTMLElement>>;
  onClose: () => void;
}

function PlayerDetailsPopover({
  player,
  name,
  live,
  conduct,
  friends,
  blockedUserIds,
  onChange,
  onCycleColor,
  stats,
  statuses,
  panelRef,
  scrollRef,
  avoidPicker,
  rowRefs,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [, remeasure] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const scroller = scrollRef.current;
    window.addEventListener('resize', remeasure);
    scroller?.addEventListener('scroll', remeasure);
    return () => {
      window.removeEventListener('resize', remeasure);
      scroller?.removeEventListener('scroll', remeasure);
    };
  }, [scrollRef]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (ref.current?.contains(target)) return;
      if (target.closest('[data-keep-panel-open], .modal')) return;
      for (const row of rowRefs.current.values()) {
        if (row.contains(target)) return;
      }
      playSound('click');
      onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [rowRefs, onClose]);

  useLayoutEffect(() => {
    const element = ref.current;
    const anchor = rowRefs.current.get(player.id);
    const panel = panelRef.current;
    if (!element || !anchor || !panel) return;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const anchorTop = avoidPicker
      ? anchorRect.top + anchorRect.height / 2 + PICKER_CLEARANCE
      : anchorRect.top;
    const top = Math.max(GAP, Math.min(anchorTop, window.innerHeight - 160));
    element.style.top = `${top}px`;
    element.style.right = `${window.innerWidth - panelRect.left + GAP}px`;
    element.style.maxHeight = `${window.innerHeight - top - GAP}px`;
  });

  return (
    <div
      ref={ref}
      className={`position-fixed overflow-y-auto z-3 ${PANEL_BG_CLASS} border rounded d-flex flex-column`}
      style={{
        width: 'max-content',
        maxWidth: '19rem',
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <PanelPlayerDetails
        player={player}
        name={name}
        live={live}
        conduct={conduct}
        friends={friends}
        blockedUserIds={blockedUserIds}
        onChange={onChange}
        onCycleColor={onCycleColor}
      />
      <div className="d-flex flex-column gap-2 px-2 pb-2">
        <PlayerStatusIcons statuses={statuses} size={11} withLabels />
        <div className="d-flex flex-column gap-1 small">
          {stats.map((stat) => (
            <div key={stat.key} className="d-flex align-items-center gap-1">
              <WhiteIcon path={stat.icon} size={13} />
              <span className="text-body-secondary">{stat.title}</span>
              <span className="ms-auto fw-semibold">{stat.value(player)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlayerDetailsPopover;
