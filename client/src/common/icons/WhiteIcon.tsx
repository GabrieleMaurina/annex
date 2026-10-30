import { useWhiteIcon } from '../icon';

interface Props {
  path: string;
  size?: number;
  alt?: string;
}

function WhiteIcon({ path, size = 16, alt = '' }: Props) {
  const white = useWhiteIcon(path);
  return <img src={white ?? path} width={size} height={size} alt={alt} />;
}

export default WhiteIcon;
