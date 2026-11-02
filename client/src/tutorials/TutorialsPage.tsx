import { useEffect, useState } from 'react';
import { Badge, Button, Container, ListGroup } from 'react-bootstrap';
import type { Account } from '../lib/types';
import { SECTION_CLASS } from '../ui/containers/panelStyle';
import TutorialGuide from './guide/TutorialGuide';
import { loadCompletedTutorials } from './progress';
import { TUTORIALS } from './tutorials';

interface Props {
  account: Account | null;
  navigate: (path: string) => void;
}

function TutorialsPage({ account, navigate }: Props) {
  const [completed, setCompleted] = useState<string[] | null>(null);

  useEffect(() => {
    let stale = false;
    loadCompletedTutorials(account).then((ids) => {
      if (!stale) setCompleted(ids);
    });
    return () => {
      stale = true;
    };
  }, [account]);

  const completedIds = completed ?? [];
  const upNext = TUTORIALS.find((t) => !completedIds.includes(t.id));
  const doneCount = TUTORIALS.filter((t) => completedIds.includes(t.id)).length;

  return (
    <Container className="py-5 px-2 px-sm-4" style={{ maxWidth: 760 }}>
      <h1 className="text-center mb-2">Tutorials</h1>
      <p className="text-center text-body-secondary mb-4">
        Short hands-on lessons on a tiny map. Play them in order, or jump to any
        one you like.
      </p>

      {completed && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="text-body-secondary">
            {doneCount}/{TUTORIALS.length} completed
          </span>
          <Button
            onClick={() =>
              navigate(`/tutorials/${(upNext ?? TUTORIALS[0]).id}`)
            }
          >
            {upNext
              ? doneCount === 0
                ? 'Start'
                : `Continue: ${upNext.title}`
              : 'Play again'}
          </Button>
        </div>
      )}

      <ListGroup className={`${SECTION_CLASS} mb-5`}>
        {TUTORIALS.map((tutorial, index) => {
          const done = completedIds.includes(tutorial.id);
          return (
            <ListGroup.Item
              key={tutorial.id}
              className="d-flex align-items-center gap-3"
            >
              <span className="fw-bold fs-4 text-body-secondary">
                {index + 1}
              </span>
              <div className="flex-grow-1">
                <div className="fw-semibold d-flex align-items-center gap-2">
                  {tutorial.title}
                  {done && <Badge bg="success">Done</Badge>}
                </div>
                <div className="small text-body-secondary">
                  {tutorial.summary}
                </div>
              </div>
              <Button
                variant={tutorial === upNext ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => navigate(`/tutorials/${tutorial.id}`)}
              >
                {done ? 'Replay' : 'Play'}
              </Button>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      <TutorialGuide />
    </Container>
  );
}

export default TutorialsPage;
