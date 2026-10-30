import { useState } from 'react';
import { Button } from 'react-bootstrap';
import MapGenerationModal from '../MapGenerationModal';
import {
  generateMap,
  type GeneratedEditorMap,
  type GenerateInput,
} from './generateMap';

interface Props {
  show: boolean;
  onHide: () => void;
  onGenerated: (map: GeneratedEditorMap, input: GenerateInput) => void;
}

function GenerateMapModal({ show, onHide, onGenerated }: Props) {
  const [result, setResult] = useState<{
    map: GeneratedEditorMap;
    input: GenerateInput;
  } | null>(null);
  const [error, setError] = useState('');

  function hide() {
    setResult(null);
    setError('');
    onHide();
  }

  return (
    <MapGenerationModal
      show={show}
      onHide={hide}
      preview={result?.map ?? null}
      error={error}
      note="Using a map replaces the current territories and background image. You can then edit and draw on top before saving."
      generate={(input, onSettled) => {
        setError('');
        generateMap(input)
          .then((map) => {
            setResult({ map, input });
            onSettled(true);
          })
          .catch(() => {
            setError('Could not generate a map. Try a different seed.');
            onSettled(false);
          });
      }}
      confirm={
        <Button
          disabled={!result}
          onClick={() => {
            if (!result) return;
            onGenerated(result.map, result.input);
            hide();
          }}
        >
          Use this map
        </Button>
      }
    />
  );
}

export default GenerateMapModal;
