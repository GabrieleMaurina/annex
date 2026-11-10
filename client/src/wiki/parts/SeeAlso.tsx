import WikiLink from './WikiLink';

interface Props {
  pages: string[];
}

function SeeAlso({ pages }: Props) {
  return (
    <div
      data-skip-search
      className="d-flex flex-wrap align-items-center mt-4 pt-3 border-top"
    >
      <span className="small fw-semibold text-uppercase text-body-secondary me-1">
        See also
      </span>
      {pages.map((id) => (
        <WikiLink key={id} to={id} />
      ))}
    </div>
  );
}

export default SeeAlso;
