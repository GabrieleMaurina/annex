import { useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import InstallButton from '../../common/InstallButton';
import WhiteIcon from '../../common/icons/WhiteIcon';
import Hero from '../../common/page/Hero';
import useStackOnOverflow from '../../common/page/useStackOnOverflow';
import Tip from '../../common/tooltips/Tip';

const NAME_DEFINITION =
  '/ænˈeks/ (verb) : to take possession of an area of land or a country, usually by force or without permission';

const QUICK_PLAY_TIP = 'Jump into a match in seconds';
const CREATE_ONLINE_TIP = 'Host a game and invite other players';
const CREATE_OFFLINE_TIP = 'Play against bots';

interface Props {
  serverUnreachable: boolean;
  joiningRandom: boolean;
  showTutorials: boolean;
  onJoinRandom: () => void;
  onCancelJoin: () => void;
  onCreateOnline: () => void;
  onCreateOffline: () => void;
  onTutorials: () => void;
}

interface CallToActionProps {
  label: string;
  tip?: string;
  tipBelow?: boolean;
  busy?: boolean;
  onClick: () => void;
}

function CallToAction({
  label,
  tip,
  tipBelow,
  busy,
  onClick,
}: CallToActionProps) {
  const button = (
    <Button
      variant="primary"
      size="lg"
      className="btn-cta d-flex align-items-center justify-content-center"
      onClick={onClick}
    >
      {busy ? (
        <Spinner />
      ) : (
        <img src="/icons/play.svg" width={32} height={32} alt="" />
      )}
      <span className="btn-cta-title">{label}</span>
    </Button>
  );
  return tip ? (
    <Tip text={tip} placement={tipBelow ? 'bottom' : undefined}>
      {button}
    </Tip>
  ) : (
    button
  );
}

function HomeHero({
  serverUnreachable,
  joiningRandom,
  showTutorials,
  onJoinRandom,
  onCancelJoin,
  onCreateOnline,
  onCreateOffline,
  onTutorials,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  useStackOnOverflow(sectionRef);
  return (
    <section ref={sectionRef} className="hero-top hero-top-split">
      <Hero
        title="Annex"
        tagline="Multiplayer strategy war game"
        titleTip={NAME_DEFINITION}
      />
      <div className="home-actions rise rise-4">
        {serverUnreachable ? (
          <CallToAction
            label="Create Offline"
            tip={CREATE_OFFLINE_TIP}
            tipBelow
            onClick={onCreateOffline}
          />
        ) : joiningRandom ? (
          <CallToAction label="Cancel" busy onClick={onCancelJoin} />
        ) : (
          <CallToAction
            label="Quick Play"
            tip={QUICK_PLAY_TIP}
            onClick={onJoinRandom}
          />
        )}
        <div className="d-flex flex-wrap justify-content-center gap-2">
          {!serverUnreachable && (
            <Tip text={CREATE_ONLINE_TIP} placement="bottom">
              <Button
                variant="secondary"
                size="sm"
                className="d-inline-flex align-items-center justify-content-center gap-1"
                onClick={onCreateOnline}
              >
                <WhiteIcon path="/icons/globe.svg" />
                Create Online
              </Button>
            </Tip>
          )}
          {!serverUnreachable && (
            <Tip text={CREATE_OFFLINE_TIP} placement="bottom">
              <Button
                variant="secondary"
                size="sm"
                className="d-inline-flex align-items-center justify-content-center gap-1"
                onClick={onCreateOffline}
              >
                <WhiteIcon path="/icons/bot.svg" />
                Create Offline
              </Button>
            </Tip>
          )}
          {showTutorials && (
            <Tip text="Learn the game step by step" placement="bottom">
              <Button
                variant="secondary"
                size="sm"
                className="d-inline-flex align-items-center justify-content-center gap-1"
                onClick={onTutorials}
              >
                <WhiteIcon path="/icons/book.svg" />
                Tutorials
              </Button>
            </Tip>
          )}
        </div>
        <InstallButton />
      </div>
    </section>
  );
}

export default HomeHero;
