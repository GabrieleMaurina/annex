import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { connector } from '../connector';
import { playSound } from '../lib/sounds';
import type { Account } from '../lib/types';
import { PANEL_BG_CLASS, PANEL_CLASS } from '../ui/containers/panelStyle';
import { markTutorialCompleted } from './progress';
import { nextTutorial, TUTORIALS, type Tutorial } from './tutorials';

const CELEBRATION_DELAY_MS = 1200;

interface Props {
  tutorial: Tutorial;
  account: Account | null;
  navigate: (path: string) => void;
}

function TutorialOverlay({ tutorial, account, navigate }: Props) {
  const [completed, setCompleted] = useState(false);
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
          className={`${PANEL_BG_CLASS} ${PANEL_CLASS} position-fixed top-0 start-50 translate-middle-x mt-3 col-7 col-md-4 text-center z-2`}
        >
          <div className="fw-bold">{tutorial.title}</div>
          <div className="small mb-2">{tutorial.instruction}</div>
          <Button
            variant="secondary"
            size="sm"
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
