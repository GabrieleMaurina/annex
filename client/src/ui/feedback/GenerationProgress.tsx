import { ProgressBar } from 'react-bootstrap';

interface Props {
  text: string;
  now?: number;
  animated?: boolean;
  className?: string;
}

export default function GenerationProgress({
  text,
  now = 100,
  animated = true,
  className,
}: Props) {
  return (
    <>
      <span className="small">{text}</span>
      <ProgressBar now={now} animated={animated} className={className} />
    </>
  );
}
