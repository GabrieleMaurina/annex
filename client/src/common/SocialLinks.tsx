import type { ReactNode } from 'react';
import { Button } from 'react-bootstrap';
import WhiteIcon from './icons/WhiteIcon';
import Tip from './tooltips/Tip';

const SOCIAL_LINKS = [
  {
    name: 'Discord',
    icon: '/icons/discord.svg',
    url: 'https://discord.gg/2AyYzBrHZ',
  },
  {
    name: 'itch.io',
    icon: '/icons/itch.svg',
    url: 'https://annexgame.itch.io/annexgame',
  },
  { name: 'X', icon: '/icons/x.svg', url: 'https://x.com/annexstrategy' },
  {
    name: 'YouTube',
    icon: '/icons/youtube.svg',
    url: 'https://www.youtube.com/channel/UCLbKo3d0IrDn6INuGLz55OA',
  },
  {
    name: 'TikTok',
    icon: '/icons/tiktok.svg',
    url: 'https://www.tiktok.com/@annexgame',
  },
  {
    name: 'Instagram',
    icon: '/icons/instagram.svg',
    url: 'https://www.instagram.com/annexstrategygame',
  },
  {
    name: 'GitHub',
    icon: '/icons/github.svg',
    url: 'https://github.com/GabrieleMaurina/annex',
  },
];

interface Props {
  children?: ReactNode;
}

function SocialLinks({ children }: Props) {
  return (
    <div className="social-links d-flex flex-wrap justify-content-center gap-2">
      {SOCIAL_LINKS.map((link) => (
        <Tip key={link.name} text={link.name}>
          <Button
            variant="secondary"
            href={link.url}
            target="_blank"
            rel="noreferrer"
            aria-label={link.name}
            className="d-flex align-items-center justify-content-center"
          >
            <WhiteIcon path={link.icon} size={20} />
          </Button>
        </Tip>
      ))}
      {children}
    </div>
  );
}

export default SocialLinks;
