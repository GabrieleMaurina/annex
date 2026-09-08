import {
  ANTI_NUKE_INSTALLMENT,
  NUKE_INSTALLMENT,
  NUKE_INSTALLMENTS,
} from 'engine';
import { Badge, Button, ListGroup, ProgressBar } from 'react-bootstrap';
import PanelHeader from '../../common/PanelHeader';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../../common/panelStyle';
import type { Arsenal, NukeProject } from '../../lib/types';

interface Props {
  arsenal: Arsenal;
  projects: NukeProject[];
  roundNumber: number;
  troopsToDeploy: number;
  isMyTurn: boolean;
  turnPhase: string;
  paused: boolean;
  targeting: 'launch' | 'antiNuke' | null;
  onBuildNuke: () => void;
  onBuildAntiNuke: () => void;
  onAdvance: (index: number) => void;
  onArm: (mode: 'launch' | 'antiNuke') => void;
  onClose: () => void;
}

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
  onBuildNuke,
  onBuildAntiNuke,
  onAdvance,
  onArm,
  onClose,
}: Props) {
  const canBuild = isMyTurn && !paused && turnPhase === 'deploy';
  const canUse = isMyTurn && !paused && turnPhase === 'attack';

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
          <Button
            size="sm"
            variant={targeting === 'launch' ? 'secondary' : 'outline-secondary'}
            className="flex-fill text-nowrap"
            disabled={arsenal.nukes < 1}
            onClick={() => onArm('launch')}
          >
            {targeting === 'launch' ? 'Pick target…' : 'Launch nuke'}
          </Button>
          <Button
            size="sm"
            variant={
              targeting === 'antiNuke' ? 'secondary' : 'outline-secondary'
            }
            className="flex-fill text-nowrap"
            disabled={arsenal.antiNukes < 1}
            onClick={() => onArm('antiNuke')}
          >
            {targeting === 'antiNuke' ? 'Pick territory…' : 'Deploy anti-nuke'}
          </Button>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="fw-bold lh-1 mb-2 mt-2">Under construction</div>
          <ListGroup className="mb-2">
            {projects.map((project, index) => {
              const advancedThisTurn = project.lastPaidRound >= roundNumber;
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
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    className="ms-1"
                    disabled={
                      !canBuild ||
                      advancedThisTurn ||
                      troopsToDeploy < cost(project.kind)
                    }
                    onClick={() => onAdvance(index)}
                  >
                    {advancedThisTurn
                      ? 'Paid'
                      : `Advance (${cost(project.kind)})`}
                  </Button>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </>
      )}

      {canBuild && (
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            className="flex-fill text-nowrap"
            disabled={troopsToDeploy < NUKE_INSTALLMENT}
            onClick={onBuildNuke}
          >
            Build nuke ({NUKE_INSTALLMENT})
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            className="flex-fill text-nowrap"
            disabled={troopsToDeploy < ANTI_NUKE_INSTALLMENT}
            onClick={onBuildAntiNuke}
          >
            Build anti-nuke ({ANTI_NUKE_INSTALLMENT})
          </Button>
        </div>
      )}

      {!canBuild && !canUse && (
        <div className="text-muted small">
          Build during your deploy phase, launch during your attack phase.
        </div>
      )}
    </div>
  );
}

export default NukesPanel;
