import {
  ANTI_NUKE_INSTALLMENT,
  NUKE_INSTALLMENT,
  NUKE_INSTALLMENTS,
} from 'engine';
import { Badge, Button, ListGroup, ProgressBar } from 'react-bootstrap';
import WhiteIcon from '../../common/icons/WhiteIcon';
import PanelHeader from '../../common/PanelHeader';
import TipSpan from '../../common/tooltips/TipSpan';
import type { Arsenal, NukeProject } from '../../lib/types';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../ui/containers/panelStyle';

interface Props {
  arsenal: Arsenal;
  projects: NukeProject[];
  roundNumber: number;
  troopsToDeploy: number;
  isMyTurn: boolean;
  turnPhase: string;
  paused: boolean;
  targeting: 'launch' | 'antiNuke' | null;
  readOnly?: boolean;
  onBuildNuke: () => void;
  onBuildAntiNuke: () => void;
  onAdvance: (index: number) => void;
  onArm: (mode: 'launch' | 'antiNuke') => void;
  onClose: () => void;
}

const BLOCK_BUTTON =
  'd-inline-flex align-items-center justify-content-center gap-1 text-nowrap';

function label(kind: NukeProject['kind']): string {
  return kind === 'nuke' ? 'Nuke' : 'Anti-nuke';
}

function cost(kind: NukeProject['kind']): number {
  return kind === 'nuke' ? NUKE_INSTALLMENT : ANTI_NUKE_INSTALLMENT;
}

function NukesPanel({
  arsenal,
  projects,
  roundNumber,
  troopsToDeploy,
  isMyTurn,
  turnPhase,
  paused,
  targeting,
  readOnly,
  onBuildNuke,
  onBuildAntiNuke,
  onAdvance,
  onArm,
  onClose,
}: Props) {
  const canBuild = !readOnly && isMyTurn && !paused && turnPhase === 'deploy';
  const canUse = !readOnly && isMyTurn && !paused && turnPhase === 'attack';

  return (
    <div className={`${PANEL_BG_CLASS} ${PANEL_CLASS}`} style={{ width: 344 }}>
      <PanelHeader title="Nukes" onClose={onClose} />

      <div className="d-flex gap-2 mb-2">
        <Badge bg="secondary">
          {arsenal.nukes} nuke{arsenal.nukes === 1 ? '' : 's'}
        </Badge>
        <Badge bg="secondary">
          {arsenal.antiNukes} anti-nuke{arsenal.antiNukes === 1 ? '' : 's'}
        </Badge>
      </div>

      {canUse && (arsenal.nukes > 0 || arsenal.antiNukes > 0) && (
        <div className="d-flex gap-2 mb-2">
          <TipSpan
            className="flex-fill d-flex"
            text={
              arsenal.nukes < 1
                ? 'You have no nuke'
                : 'Arm a nuke, then pick the target on the map'
            }
          >
            <Button
              size="sm"
              variant={targeting === 'launch' ? 'primary' : 'secondary'}
              className={`${BLOCK_BUTTON} flex-fill`}
              disabled={arsenal.nukes < 1}
              onClick={() => onArm('launch')}
            >
              <WhiteIcon path="/icons/nuke.svg" />
              {targeting === 'launch' ? 'Pick target…' : 'Launch nuke'}
            </Button>
          </TipSpan>
          <TipSpan
            className="flex-fill d-flex"
            text={
              arsenal.antiNukes < 1
                ? 'You have no anti-nuke'
                : 'Arm an anti-nuke, then pick the territory'
            }
          >
            <Button
              size="sm"
              variant={targeting === 'antiNuke' ? 'primary' : 'secondary'}
              className={`${BLOCK_BUTTON} flex-fill`}
              disabled={arsenal.antiNukes < 1}
              onClick={() => onArm('antiNuke')}
            >
              <WhiteIcon path="/icons/anti-nuke.svg" />
              {targeting === 'antiNuke'
                ? 'Pick territory…'
                : 'Deploy anti-nuke'}
            </Button>
          </TipSpan>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="fw-bold lh-1 mb-2 mt-2">Under construction</div>
          <ListGroup className="mb-2">
            {projects.map((project, index) => {
              const advancedThisRound = project.lastPaidRound >= roundNumber;
              return (
                <ListGroup.Item
                  key={index}
                  className="d-flex align-items-center gap-2 py-1"
                >
                  <span style={{ minWidth: 58 }}>{label(project.kind)}</span>
                  <span className="text-muted small">
                    {project.installmentsPaid}/{NUKE_INSTALLMENTS}
                  </span>
                  <ProgressBar
                    now={project.installmentsPaid}
                    max={NUKE_INSTALLMENTS}
                    variant="secondary"
                    className="flex-fill"
                    style={{ height: 6 }}
                  />
                  <TipSpan
                    className="ms-1"
                    text={`Pay ${cost(project.kind)} troops, once per round`}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      className="d-inline-flex align-items-center justify-content-center gap-1"
                      disabled={
                        !canBuild ||
                        advancedThisRound ||
                        troopsToDeploy < cost(project.kind)
                      }
                      onClick={() => onAdvance(index)}
                    >
                      <WhiteIcon path="/icons/skip-forward.svg" />
                      {advancedThisRound
                        ? 'Paid'
                        : `Advance (${cost(project.kind)})`}
                    </Button>
                  </TipSpan>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </>
      )}

      {canBuild && (
        <div className="d-flex gap-2">
          <TipSpan
            className="flex-fill d-flex"
            text={`Pay the first installment (${NUKE_INSTALLMENT} troops). Later installments are paid one per round`}
          >
            <Button
              size="sm"
              variant="secondary"
              className={`${BLOCK_BUTTON} flex-fill`}
              disabled={troopsToDeploy < NUKE_INSTALLMENT}
              onClick={onBuildNuke}
            >
              <WhiteIcon path="/icons/plus.svg" />
              Build nuke ({NUKE_INSTALLMENT})
            </Button>
          </TipSpan>
          <TipSpan
            className="flex-fill d-flex"
            text={`Pay the first installment (${ANTI_NUKE_INSTALLMENT} troops). Later installments are paid one per round`}
          >
            <Button
              size="sm"
              variant="secondary"
              className={`${BLOCK_BUTTON} flex-fill`}
              disabled={troopsToDeploy < ANTI_NUKE_INSTALLMENT}
              onClick={onBuildAntiNuke}
            >
              <WhiteIcon path="/icons/plus.svg" />
              Build anti-nuke ({ANTI_NUKE_INSTALLMENT})
            </Button>
          </TipSpan>
        </div>
      )}

      {!readOnly && !canBuild && !canUse && (
        <div className="text-muted small">
          Build during your deploy phase, launch during your attack phase.
        </div>
      )}
    </div>
  );
}

export default NukesPanel;
