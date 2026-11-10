import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { WIKI_PAGES } from '../tree';

interface Props {
  pageId: string;
}

function PrevNext({ pageId }: Props) {
  const navigate = useNavigate();
  const index = WIKI_PAGES.findIndex((page) => page.id === pageId);
  const previous = WIKI_PAGES[index - 1];
  const next = WIKI_PAGES[index + 1];
  return (
    <div className="d-flex justify-content-between gap-2 mt-4">
      {previous ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/wiki/${previous.id}`)}
        >
          ‹ {previous.title}
        </Button>
      ) : (
        <span />
      )}
      {next && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/wiki/${next.id}`)}
        >
          {next.title} ›
        </Button>
      )}
    </div>
  );
}

export default PrevNext;
