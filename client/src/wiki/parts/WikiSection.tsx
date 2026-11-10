import type { ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

function WikiSection({ id, title, children }: Props) {
  return (
    <section id={id} className="mb-4">
      <h3 className="fs-4 mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default WikiSection;
