import { scaled } from '../../ui/uiScale';
import { useZombiePulse } from './zombiePulse';

interface Props {
  size: number;
  isTurn?: boolean;
}

function ZombieIcon({ size, isTurn = false }: Props) {
  const pulse = useZombiePulse();
  const classes = [
    'zombie-icon overflow-visible',
    isTurn ? 'zombie-icon-turn' : '',
    pulse > 0 ? 'zombie-icon-surge' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <svg
      key={pulse}
      className={classes}
      width={scaled(size)}
      height={scaled(size)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        className="zombie-icon-head"
        fillRule="evenodd"
        d="M12 2C7.6 2 4.5 5.3 4.5 9.5c0 2.4 1 4.2 2.5 5.4V16h10v-1.1c1.5-1.2 2.5-3 2.5-5.4C19.5 5.3 16.4 2 12 2zM7 9.5a2 2.4 0 1 0 4 0 2 2.4 0 1 0-4 0zM13 9.2a1.6 1.9 0 1 0 3.2 0 1.6 1.9 0 1 0-3.2 0zM12 12l-1 2h2zM8 4.8l3 1.2-.3.9-3-1.2z"
      />
      <path
        className="zombie-icon-jaw"
        d="M7 16.8V18c0 .6.4 1 1 1h1v2.5h2V19h2.5v2.5h2V19H16c.6 0 1-.4 1-1v-1.2z"
      />
    </svg>
  );
}

export default ZombieIcon;
