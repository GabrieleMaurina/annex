import { Suspense, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import LoadBoundary from '../../common/page/LoadBoundary';
import PagePanel from '../../common/page/PagePanel';
import Breadcrumbs from '../nav/Breadcrumbs';
import PrevNext from '../nav/PrevNext';
import { PAGE_COMPONENTS } from '../pageRegistry';
import type { WikiPageInfo } from '../tree';

interface Props {
  page: WikiPageInfo;
}

function ScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return null;
}

function PageView({ page }: Props) {
  const Body = PAGE_COMPONENTS[page.id];
  return (
    <>
      <Breadcrumbs sectionId={page.section} pageTitle={page.title} />
      <PagePanel title={page.title}>
        <p className="text-body-secondary">{page.summary}</p>
        <LoadBoundary key={page.id}>
          <Suspense
            fallback={
              <div className="text-center py-4">
                <Spinner size="sm" className="me-2" />
                Loading...
              </div>
            }
          >
            <Body />
            <ScrollToHash />
          </Suspense>
        </LoadBoundary>
        <PrevNext pageId={page.id} />
      </PagePanel>
    </>
  );
}

export default PageView;
