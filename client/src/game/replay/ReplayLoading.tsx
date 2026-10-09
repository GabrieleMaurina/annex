import { Spinner } from 'react-bootstrap';

function ReplayLoading() {
  return (
    <div className="position-fixed top-0 start-50 translate-middle-x mt-3 d-flex align-items-center">
      <Spinner size="sm" className="me-2" />
      Loading replay...
    </div>
  );
}

export default ReplayLoading;
