import Tip from '../tooltips/Tip';

interface Props {
  title: string;
  tagline: string;
  titleTip?: string;
}

function Hero({ title, tagline, titleTip }: Props) {
  const heading = <h1 className="hero-title rise rise-1">{title}</h1>;
  return (
    <header className="hero">
      <img className="hero-logo" src="/favicon.svg" alt="" />
      <div>
        {titleTip ? <Tip text={titleTip}>{heading}</Tip> : heading}
        <p className="hero-tag small fw-semibold text-uppercase text-body-secondary mt-2 mb-0 rise rise-2">
          {tagline}
        </p>
        <div className="hero-rule rise rise-3">
          <span />
        </div>
      </div>
    </header>
  );
}

export default Hero;
