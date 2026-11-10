import { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import {
  Navigate,
  useLocation,
  useNavigationType,
  useParams,
} from 'react-router-dom';
import { Gate } from '../ui/containers/PageGate';
import WikiNav from './nav/WikiNav';
import SearchBox from './search/SearchBox';
import { findPage, findSection } from './tree';
import PageView from './views/PageView';
import SectionIndex from './views/SectionIndex';
import WikiHome from './views/WikiHome';

function Wiki() {
  const { '*': path = '' } = useParams();
  const { hash } = useLocation();
  const navigationType = useNavigationType();
  const id = path.replace(/\/+$/, '');
  const page = findPage(id);
  const section = findSection(id);
  const title = page?.title ?? section?.title;

  const [gate, setGate] = useState({ id, opening: 0 });

  useEffect(() => {
    if (!hash && navigationType !== 'POP') window.scrollTo(0, 0);
  }, [id, hash, navigationType]);

  useEffect(() => {
    document.title = `${title ? `${title} - ` : ''}Wiki - Annex`;
  }, [title]);

  if (id !== '' && !page && !section) {
    const parent = findSection(id.split('/')[0]);
    return <Navigate to={parent ? `/wiki/${parent.id}` : '/wiki'} replace />;
  }

  if (gate.id !== id) setGate({ id, opening: gate.opening + 1 });

  return (
    <Container className="py-5 px-2 px-sm-4">
      <h1 className="text-center mb-4">Wiki</h1>
      <Row className="justify-content-center mb-4">
        <Col md={8} lg={6}>
          <SearchBox />
        </Col>
      </Row>
      <Row className="g-4">
        <Col lg={3}>
          <div className="d-lg-none">
            <details key={id}>
              <summary className="collapsible-summary">Contents</summary>
              <div className="pt-2">
                <WikiNav currentId={id} />
              </div>
            </details>
          </div>
          <div
            className="d-none d-lg-block position-sticky overflow-y-auto no-scrollbar"
            style={{ top: '1rem', maxHeight: 'calc(100dvh - 2rem)' }}
          >
            <WikiNav currentId={id} />
          </div>
        </Col>
        <Col lg={9}>
          <div className="position-relative">
            {gate.opening > 0 && <Gate key={gate.opening} local silent />}
            {page ? (
              <PageView page={page} />
            ) : section ? (
              <SectionIndex section={section} />
            ) : (
              <WikiHome />
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Wiki;
