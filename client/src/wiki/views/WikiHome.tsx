import { Col, Row } from 'react-bootstrap';
import PagePanel from '../../common/page/PagePanel';
import WikiLink from '../parts/WikiLink';
import { WIKI_SECTIONS } from '../tree';

function WikiHome() {
  return (
    <>
      <PagePanel title="Welcome to the Annex wiki" className="mb-4">
        <p>
          Everything about the game, written to be short and exact. Pick a
          section below, use the contents on the side, or follow the buttons
          inside any page.
        </p>
        <div className="d-flex flex-wrap align-items-center">
          <span className="small fw-semibold text-uppercase text-body-secondary me-1">
            New player
          </span>
          <WikiLink to="start/welcome" />
          <WikiLink to="start/first-game" />
          <WikiLink to="rules/turns" />
        </div>
        <div className="d-flex flex-wrap align-items-center">
          <span className="small fw-semibold text-uppercase text-body-secondary me-1">
            Hosting
          </span>
          <WikiLink to="play/create" />
          <WikiLink to="settings/overview" />
          <WikiLink to="modes/overview" />
        </div>
        <div className="d-flex flex-wrap align-items-center">
          <span className="small fw-semibold text-uppercase text-body-secondary me-1">
            Competing
          </span>
          <WikiLink to="ranking/elo" />
          <WikiLink to="ranking/reputation" />
          <WikiLink to="strategy/basics" />
        </div>
      </PagePanel>
      <Row className="g-3">
        {WIKI_SECTIONS.map((section) => (
          <Col key={section.id} md={6} xl={4}>
            <PagePanel title={section.title} className="h-100">
              <p className="small text-body-secondary">{section.summary}</p>
              <div className="d-flex flex-wrap align-items-center">
                {section.pages.map((page) => (
                  <WikiLink key={page.id} to={page.id} />
                ))}
              </div>
            </PagePanel>
          </Col>
        ))}
      </Row>
    </>
  );
}

export default WikiHome;
