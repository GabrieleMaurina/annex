import SharePageButton from '../menus/SharePageButton';
import SocialLinks from '../SocialLinks';

function SiteFooter() {
  return (
    <footer className="container mt-auto pt-5 pb-4">
      <div className="site-footer-rule mb-4" />
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-md-between gap-4">
        <div className="d-flex align-items-center gap-3">
          <img
            className="site-footer-logo"
            src="/favicon.svg"
            alt=""
            width={40}
            height={40}
          />
          <div>
            <div className="site-footer-name">ANNEX</div>
            <small className="text-body-secondary">
              Free. Open source. Forever.
            </small>
          </div>
        </div>
        <div className="d-flex flex-column align-items-center gap-2">
          <small className="site-footer-label text-uppercase fw-semibold text-body-secondary">
            Follow us on the socials
          </small>
          <SocialLinks>
            <SharePageButton
              title="Annex"
              path="/"
              tooltip="Share Annex with friends"
            />
          </SocialLinks>
        </div>
      </div>
      <div className="text-center small text-body-secondary mt-4">
        Made by gamers, for gamers · No ads · No microtransactions
      </div>
    </footer>
  );
}

export default SiteFooter;
