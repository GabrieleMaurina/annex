import { Fragment, useLayoutEffect, useRef } from 'react';
import { ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import { WIKI_SECTIONS } from '../tree';

interface Props {
  currentId: string;
}

function itemClass(active: boolean, extra = ''): string {
  return `bg-transparent ${extra} ${active ? 'text-primary fw-semibold' : ''}`.trim();
}

function WikiNav({ currentId }: Props) {
  const navigate = useNavigate();
  const currentSection = currentId.split('/')[0];
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current!;

    function place() {
      const indicator = indicatorRef.current;
      const active = list.querySelector<HTMLElement>('[data-active]');
      if (!indicator || !active || active.offsetHeight === 0) return;
      if (!placedRef.current) indicator.classList.add('list-indicator-instant');
      indicator.style.top = `${active.offsetTop}px`;
      indicator.style.height = `${active.offsetHeight}px`;
      const scroller = list.parentElement!;
      const bottom = active.offsetTop + active.offsetHeight;
      if (active.offsetTop < scroller.scrollTop)
        scroller.scrollTop = active.offsetTop;
      else if (bottom > scroller.scrollTop + scroller.clientHeight)
        scroller.scrollTop = bottom - scroller.clientHeight;
      if (!placedRef.current) {
        void indicator.offsetHeight;
        indicator.classList.remove('list-indicator-instant');
        placedRef.current = true;
      }
    }

    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [currentId]);

  return (
    <ListGroup
      as="nav"
      aria-label="Wiki contents"
      ref={listRef}
      className={`${SECTION_CLASS} position-relative overflow-hidden`}
    >
      <div ref={indicatorRef} className="list-indicator" />
      <ListGroup.Item
        action
        data-active={currentId === '' || undefined}
        aria-current={currentId === '' ? 'page' : undefined}
        className={itemClass(currentId === '', 'fw-semibold')}
        onClick={() => navigate('/wiki')}
      >
        Wiki home
      </ListGroup.Item>
      {WIKI_SECTIONS.map((section) => (
        <Fragment key={section.id}>
          <ListGroup.Item
            action
            data-active={currentId === section.id || undefined}
            aria-current={currentId === section.id ? 'page' : undefined}
            className={itemClass(currentId === section.id, 'fw-semibold')}
            onClick={() => navigate(`/wiki/${section.id}`)}
          >
            {section.title}
          </ListGroup.Item>
          {currentSection === section.id &&
            section.pages.map((page) => (
              <ListGroup.Item
                key={page.id}
                action
                data-active={currentId === page.id || undefined}
                aria-current={currentId === page.id ? 'page' : undefined}
                className={itemClass(currentId === page.id, 'ps-5 small')}
                onClick={() => navigate(`/wiki/${page.id}`)}
              >
                {page.title}
              </ListGroup.Item>
            ))}
        </Fragment>
      ))}
    </ListGroup>
  );
}

export default WikiNav;
