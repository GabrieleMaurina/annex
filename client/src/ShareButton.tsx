import { useState } from 'react';
import { Button, Toast, ToastContainer } from 'react-bootstrap';
import { useWhiteIcon } from './icon';

interface Props {
  url: string;
}

function ShareButton({ url }: Props) {
  const [copied, setCopied] = useState(false);
  const whiteShareIcon = useWhiteIcon('/share.svg');

  function share() {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
      },
      () => {},
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={share} title="Copy link">
        <img
          src={whiteShareIcon ?? '/share.svg'}
          width={16}
          height={16}
          alt="Share"
        />
      </Button>
      <ToastContainer
        position="top-center"
        className="position-fixed p-3"
        style={{ zIndex: 3 }}
      >
        <Toast
          show={copied}
          onClose={() => setCopied(false)}
          autohide
          delay={3000}
        >
          <Toast.Body>Link copied to clipboard!</Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
}

export default ShareButton;
