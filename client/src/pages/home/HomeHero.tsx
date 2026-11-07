import { useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import InstallButton from '../../common/InstallButton';
import Hero from '../../common/page/Hero';
import useStackOnOverflow from '../../common/page/useStackOnOverflow';

const NAME_DEFINITION =
  '/ænˈeks/ (verb) : to take possession of an area of land or a country, usually by force or without permission';

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
  hint: string;
  busy?: boolean;
  onClick: () => void;
}

function CallToAction({ label, hint, busy, onClick }: CallToActionProps) {
  return (
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
      <span>
        <span className="btn-cta-title">{label}</span>
        <span className="btn-cta-hint">{hint}</span>
      </span>
    </Button>
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
    <section ref={sectionRef} className="hero-top">
      <Hero
        title="Annex"
        tagline="Multiplayer strategy war game"
        titleTip={NAME_DEFINITION}
      />
      <div className="home-actions rise rise-4">
        {serverUnreachable ? (
          <CallToAction
            label="Create Offline"
            hint="Play against bots"
            onClick={onCreateOffline}
          />
        ) : joiningRandom ? (
          <CallToAction
            label="Cancel"
            hint="Looking for a game"
            busy
            onClick={onCancelJoin}
          />
        ) : (
          <CallToAction
            label="Join Random Game"
            hint="Jump into a match in seconds"
            onClick={onJoinRandom}
          />
        )}
        <div className="d-flex flex-wrap justify-content-center gap-2">
          {!serverUnreachable && (
            <Button variant="secondary" size="sm" onClick={onCreateOnline}>
              Create Online
            </Button>
          )}
          {!serverUnreachable && (
            <Button variant="secondary" size="sm" onClick={onCreateOffline}>
              Create Offline
            </Button>
          )}
          {showTutorials && (
            <Button variant="secondary" size="sm" onClick={onTutorials}>
              Tutorials
            </Button>
          )}
        </div>
        <InstallButton />
      </div>
    </section>
  );
}

export default HomeHero;
