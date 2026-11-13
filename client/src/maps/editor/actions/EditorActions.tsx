import { Button } from 'react-bootstrap';
import WhiteIcon from '../../../common/icons/WhiteIcon';
import Tip from '../../../common/tooltips/Tip';
import TipSpan from '../../../common/tooltips/TipSpan';
import SpinningGears from '../../../ui/buttons/SpinningGears';

const ACTION_BUTTON =
  'flex-fill d-flex align-items-center justify-content-center gap-1';

interface Props {
  onNew: () => void;
  onGenerate: () => void;
  onWorldMap: () => void;
  onImportImage: () => void;
  onImportLibrary: () => void;
  onSave: () => void;
  onLeave: () => void;
  saving: boolean;
  dirty: boolean;
  mapEmpty: boolean;
  nameError: string;
}

function EditorActions({
  onNew,
  onGenerate,
  onWorldMap,
  onImportImage,
  onImportLibrary,
  onSave,
  onLeave,
  saving,
  dirty,
  mapEmpty,
  nameError,
}: Props) {
  return (
    <>
      <div className="d-flex gap-2 mb-2">
        <Tip text="Start a blank map">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onNew}
          >
            <WhiteIcon path="/icons/plus.svg" />
            New
          </Button>
        </Tip>
        <Tip text="Generate a random map">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onGenerate}
          >
            <SpinningGears />
            Generate
          </Button>
        </Tip>
        <Tip text="Create a map from real-world geography">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onWorldMap}
          >
            <WhiteIcon path="/icons/globe.svg" />
            Earth
          </Button>
        </Tip>
      </div>
      <div className="d-flex gap-2 mb-2">
        <Tip text="Use an image file as the map picture">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onImportImage}
          >
            <WhiteIcon path="/icons/image.svg" />
            Import image
          </Button>
        </Tip>
        <Tip text="Copy a map from the library">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onImportLibrary}
          >
            <WhiteIcon path="/icons/map.svg" />
            Import map
          </Button>
        </Tip>
      </div>
      <div className="d-flex gap-2 mb-2">
        <TipSpan className="flex-fill d-flex" text="Save this map">
          <Button
            variant="primary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onSave}
            disabled={saving || !dirty || mapEmpty || !!nameError}
          >
            <WhiteIcon path="/icons/save.svg" />
            {saving
              ? 'Saving…'
              : !dirty && !mapEmpty && !nameError
                ? 'Saved'
                : 'Save'}
          </Button>
        </TipSpan>
        <Tip text="Leave the editor">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION_BUTTON}
            onClick={onLeave}
          >
            <WhiteIcon path="/icons/exit.svg" />
            Leave
          </Button>
        </Tip>
      </div>
    </>
  );
}

export default EditorActions;
