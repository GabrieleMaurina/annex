import { Button } from 'react-bootstrap';
import Tip from './Tip';
import { useWhiteIcon } from './icon';

interface Props {
  url: string;
  onCopied: () => void;
}

function ShareButton({ url, onCopied }: Props) {
  const whiteShareIcon = useWhiteIcon('/icons/share.svg');

  function share() {
    navigator.clipboard.writeText(url).then(onCopied, () => {});
  }

  return (
    <Tip text="Copy link">
      <Button variant="secondary" size="sm" onClick={share}>
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

export default ShareButton;
