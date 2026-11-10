import { useEffect, useState, type CSSProperties } from 'react';
import { Badge, Button, Container, ListGroup } from 'react-bootstrap';
import type { Account } from '../lib/types';
import { SECTION_CLASS } from '../ui/containers/panelStyle';
import TutorialGuide from './guide/TutorialGuide';
import { loadCompletedTutorials } from './progress';
import { TUTORIALS } from './tutorials';

const CONTENT_MAX_WIDTH = 800;

const TOP_NAV_BUTTON_STYLE = { width: '12rem' };

const SIDE_NAV_STYLE = {
  width: `clamp(200px, calc((100vw - ${CONTENT_MAX_WIDTH}px) / 2 - 48px), 440px)`,
  fontSize: 'clamp(1rem, calc(1rem + (100vw - 1400px) / 47), 1.5rem)',
  '--bs-list-group-item-padding-x': '1em',
  '--bs-list-group-item-padding-y': '0.5em',
} as CSSProperties;

const SECTIONS = [
  { id: 'tutorials', title: 'Tutorials' },
  { id: 'conquer-the-map', title: 'Conquer the map' },
  { id: 'taking-turns', title: 'Taking turns' },
  { id: 'how-attacks-work', title: 'How attacks work' },
  { id: 'growing-stronger', title: 'Growing stronger' },
  { id: 'tips', title: 'Tips for new commanders' },
  { id: 'learn-more', title: 'Learn more' },
];

const READING_LINE = 0.3;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function findActiveSection() {
  const atBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2;
  if (atBottom) return SECTIONS[SECTIONS.length - 1].id;
  const line = window.innerHeight * READING_LINE;
  let active = SECTIONS[0].id;
  for (const section of SECTIONS) {
    const element = document.getElementById(section.id);
    if (element && element.getBoundingClientRect().top <= line) {
      active = section.id;
    }
  }
  return active;
}

interface Props {
  account: Account | null;
  navigate: (path: string) => void;
}

function TutorialsPage({ account, navigate }: Props) {
  const [completed, setCompleted] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target) document.getElementById(target)?.scrollIntoView();
    function onScroll() {
      setActiveId(findActiveSection());
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const hash = activeId === SECTIONS[0].id ? '' : `#${activeId}`;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }, [activeId]);

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
    <Container
      fluid
      className="py-5 px-2 px-sm-4"
      style={{ maxWidth: CONTENT_MAX_WIDTH }}
    >
      <ListGroup
        className={`${SECTION_CLASS} position-fixed top-50 start-0 translate-middle-y ms-3 d-none d-xxl-flex`}
        style={SIDE_NAV_STYLE}
      >
        {SECTIONS.map((section) => (
          <ListGroup.Item
            key={section.id}
            action
            active={section.id === activeId}
            onClick={() => scrollToSection(section.id)}
          >
            {section.title}
          </ListGroup.Item>
        ))}
      </ListGroup>
      <div className="d-flex flex-wrap justify-content-center gap-2 mb-4 d-xxl-none">
        {SECTIONS.map((section) => (
          <Button
            key={section.id}
            style={TOP_NAV_BUTTON_STYLE}
            size="sm"
            variant={section.id === activeId ? 'primary' : 'secondary'}
            onClick={() => scrollToSection(section.id)}
          >
            {section.title}
          </Button>
        ))}
      </div>
      <section id="tutorials">
        <h1 className="mb-2">Tutorials</h1>
        <p className="mb-2">
          Annex is a strategy game of conquest. You and your rivals, humans or
          bots, fight over a map of territories, and the last commander standing
          wins.
        </p>
        <p className="text-body-secondary mb-4">
          Start with the short hands-on lessons below, then read the guide. Play
          the lessons in order, or jump to any one you like.
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
      </section>

      <TutorialGuide />
    </Container>
  );
}

export default TutorialsPage;
