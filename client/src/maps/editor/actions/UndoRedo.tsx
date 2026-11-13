import { Button } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import TipSpan from '../../../common/tooltips/TipSpan';

const HISTORY_BUTTON =
  'flex-grow-1 d-flex align-items-center justify-content-center gap-1';

interface Props {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function UndoRedo({ onUndo, onRedo, canUndo, canRedo }: Props) {
  return (
    <div className="d-flex gap-2 mb-2">
      <TipSpan className="flex-grow-1 d-flex" text="Undo the last change">
        <Button
          size="sm"
          variant="secondary"
          className={HISTORY_BUTTON}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <WhiteIcon path="/icons/undo.svg" />
          Undo
        </Button>
      </TipSpan>
      <TipSpan className="flex-grow-1 d-flex" text="Redo the change you undid">
        <Button
          size="sm"
          variant="secondary"
          className={HISTORY_BUTTON}
          disabled={!canRedo}
          onClick={onRedo}
        >
          <WhiteIcon path="/icons/redo.svg" />
          Redo
        </Button>
      </TipSpan>
    </div>
  );
}

export default UndoRedo;
