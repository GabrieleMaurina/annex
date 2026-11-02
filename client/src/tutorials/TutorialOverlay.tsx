import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { connector } from '../connector';
import { playSound } from '../lib/sounds';
import type { Account } from '../lib/types';
import { PANEL_BG_CLASS } from '../ui/containers/panelStyle';
import { markTutorialCompleted } from './progress';
import { nextTutorial, TUTORIALS, type Tutorial } from './tutorials';

const CELEBRATION_DELAY_MS = 1200;
const SHORT_SCREEN_QUERY = '(max-height: 500px)';

interface Props {
  tutorial: Tutorial;
  account: Account | null;
  navigate: (path: string) => void;
}

function TutorialOverlay({ tutorial, account, navigate }: Props) {
  const [completed, setCompleted] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(
    () => !window.matchMedia(SHORT_SCREEN_QUERY).matches,
  );
  const accountRef = useRef(account);
  const next = nextTutorial(tutorial);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onCompleted() {
      markTutorialCompleted(tutorial.id, accountRef.current);
      timer = setTimeout(() => {
        playSound('end');
        setCompleted(true);
      }, CELEBRATION_DELAY_MS);
    }
    connector.on('tutorial:completed', onCompleted);
    return () => {
      connector.off('tutorial:completed', onCompleted);
      clearTimeout(timer);
    };
  }, [tutorial.id]);

  return (
    <>
      {!completed && (
        <div
          className={`${PANEL_BG_CLASS} border rounded p-2 position-fixed top-0 start-50 translate-middle-x mt-2 col-10 col-sm-7 col-lg-4 d-flex align-items-start gap-2 z-2`}
        >
          <details
            className="flex-grow-1"
            open={instructionOpen}
            onToggle={(e) => {
              if (e.currentTarget.open === instructionOpen) return;
              playSound('click');
              setInstructionOpen(e.currentTarget.open);
            }}
          >
            <summary className="collapsible-summary">{tutorial.title}</summary>
            <div className="small">{tutorial.instruction}</div>
          </details>
          <Button
            variant="secondary"
            size="sm"
            className="text-nowrap"
            onClick={() => navigate('/tutorials')}
          >
            Exit tutorial
          </Button>
        </div>
      )}
      <Modal show={completed} centered backdrop="static" keyboard={false}>
        <Modal.Body className="text-center p-4">
          <div className="display-3 mb-2">🎉</div>
          <h2 className="mb-2">Well done, commander!</h2>
          <p className="mb-0">
            You completed <strong>{tutorial.title}</strong>.
            {next
              ? ' Ready for the next one?'
              : ' You finished every tutorial!'}
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="secondary" onClick={() => navigate('/tutorials')}>
            Tutorials
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Home
          </Button>
          {next && (
            <Button onClick={() => navigate(`/tutorials/${next.id}`)}>
              Next: {TUTORIALS.indexOf(next) + 1}. {next.title}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default TutorialOverlay;
