import { useWhiteIcon } from '../../../common/icon';

function ToolIcon({ path }: { path: string }) {
  const white = useWhiteIcon(path);
  return <img src={white ?? path} width={16} height={16} alt="" />;
}

export default ToolIcon;
