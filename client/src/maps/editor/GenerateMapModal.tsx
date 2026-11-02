import MapGenerationModal from '../MapGenerationModal';
import type { GeneratedEditorMap, GenerateInput } from './generateMap';

interface Props {
  show: boolean;
  onHide: () => void;
  onGenerated: (map: GeneratedEditorMap, input: GenerateInput) => void;
}

function GenerateMapModal({ show, onHide, onGenerated }: Props) {
  return (
    <MapGenerationModal
      show={show}
      onHide={onHide}
      note="Using a map replaces the current territories and background image. You can then edit and draw on top before saving."
      onUse={(map, input, onSettled) => {
        onGenerated(map, input);
        onSettled(true);
      }}
    />
  );
}

export default GenerateMapModal;
