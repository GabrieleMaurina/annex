import type { RefObject } from 'react';
import { PANEL_BG_CLASS } from '../../../common/panelStyle';
import type { AllianceViewState } from '../../../lib/types';
import AlliancePopupButtons from '../AlliancePopupButtons';

export default function AlliancePopupOverlay({
  alliancePopupFor,
  allianceStateWith,
  allianceCellRefs,
  alliancePopupRef,
  respondAllianceRequest,
  setAlliancePopupFor,
  terminateAlliance,
}: {
  alliancePopupFor: number | null;
  allianceStateWith: (playerId: number) => AllianceViewState;
  allianceCellRefs: RefObject<Map<number, HTMLElement>>;
  alliancePopupRef: RefObject<HTMLDivElement | null>;
  respondAllianceRequest: (fromPlayerId: number, accept: boolean) => void;
  setAlliancePopupFor: (playerId: number | null) => void;
  terminateAlliance: (targetPlayerId: number) => void;
}) {
  if (alliancePopupFor === null) return null;
  const state = allianceStateWith(alliancePopupFor);
  if (state !== 'allied' && state !== 'requestReceived') return null;
  const rect = allianceCellRefs.current
    .get(alliancePopupFor)
    ?.getBoundingClientRect();
  if (!rect) return null;
  return (
    <div
      ref={alliancePopupRef}
      className={`position-fixed ${PANEL_BG_CLASS} border rounded d-flex align-items-center`}
      style={{
        top: rect.bottom + 4,
        left: rect.left,
        width: 'fit-content',
        padding: 0,
        zIndex: 3,
      }}
    >
      {state === 'requestReceived' ? (
        <AlliancePopupButtons
          confirmText="Accept alliance"
          denyText="Decline alliance"
          onConfirm={() => respondAllianceRequest(alliancePopupFor, true)}
          onDeny={() => respondAllianceRequest(alliancePopupFor, false)}
        />
      ) : (
        <AlliancePopupButtons
          confirmText="Keep alliance"
          denyText="Terminate alliance"
          onConfirm={() => setAlliancePopupFor(null)}
          onDeny={() => terminateAlliance(alliancePopupFor)}
        />
      )}
    </div>
  );
}
