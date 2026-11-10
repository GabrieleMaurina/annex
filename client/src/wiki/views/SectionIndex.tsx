import { ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PagePanel from '../../common/page/PagePanel';
import { SECTION_CLASS } from '../../ui/containers/panelStyle';
import Breadcrumbs from '../nav/Breadcrumbs';
import type { WikiSectionInfo } from '../tree';

interface Props {
  section: WikiSectionInfo;
}

function SectionIndex({ section }: Props) {
  const navigate = useNavigate();
  return (
    <>
      <Breadcrumbs sectionId={section.id} />
      <PagePanel title={section.title}>
        <p className="text-body-secondary">{section.summary}</p>
        <ListGroup className={SECTION_CLASS}>
          {section.pages.map((page) => (
            <ListGroup.Item
              key={page.id}
              action
              onClick={() => navigate(`/wiki/${page.id}`)}
            >
              <div className="fw-semibold">{page.title}</div>
              <div className="small text-body-secondary">{page.summary}</div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </PagePanel>
    </>
  );
}

export default SectionIndex;
