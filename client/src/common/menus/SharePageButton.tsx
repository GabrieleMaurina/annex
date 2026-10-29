import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useWhiteIcon } from '../icon';
import Tip from '../tooltips/Tip';

interface Props {
  title: string;
  path: string;
  tooltip: string;
  size?: 'sm';
}

function SharePageButton({ title, path, tooltip, size }: Props) {
  const [copied, setCopied] = useState(false);
  const whiteShareIcon = useWhiteIcon('/icons/share.svg');

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => {},
    );
  }

  return (
    <Tip text={copied ? 'Link copied' : tooltip}>
      <Button
        variant="secondary"
        size={size}
        className="d-flex align-items-center justify-content-center"
        onClick={share}
      >
        <img
          src={whiteShareIcon ?? '/icons/share.svg'}
          width={16}
          height={16}
          alt="Share"
        />
      </Button>
    </Tip>
  );
}

export default SharePageButton;
