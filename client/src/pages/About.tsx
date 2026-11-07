import { Badge, Col, Container, Row } from 'react-bootstrap';
import Hero from '../common/page/Hero';
import PagePanel from '../common/page/PagePanel';

const PROMISES = ['Free', 'Open source', 'No ads', 'No microtransactions'];

function About() {
  return (
    <Container className="hero-page pb-5">
      <section className="hero-top">
        <Hero title="Annex" tagline="About the game" />
      </section>
      <Row className="g-4">
        <Col xs={12}>
          <PagePanel title="The game" className="rise rise-4">
            <p className="border-start border-3 ps-3 text-secondary">
              <strong>annex</strong> /ænˈeks/ <em>(verb)</em>: to take
              possession of an area of land or a country, usually by force or
              without permission
            </p>
            <p className="mb-0">
              Annex is a strategy game of conquest. Claim territories, grow your
              armies and outplay your rivals. Play online against friends and
              strangers, play offline against bots, or draw your own maps in the
              editor and challenge the community to fight over them.
            </p>
          </PagePanel>
        </Col>
        <Col md={6}>
          <PagePanel
            title="Made by gamers, for gamers"
            className="h-100 rise rise-5"
          >
            <p className="mb-0">
              Annex was made to grow a community and to let gamers have fun. We
              love strategy games and wanted a place where players can come
              together to play, create and compete. Your feedback, your maps and
              your ideas shape where the game goes next.
            </p>
          </PagePanel>
        </Col>
        <Col md={6}>
          <PagePanel
            title="Free. Open source. Forever."
            className="h-100 rise rise-5"
          >
            <p>
              Annex is free to play and always will be. The source code is open
              for anyone to read, learn from and improve. There are no ads and
              no microtransactions, now or ever.
            </p>
            <div className="d-flex flex-wrap gap-2">
              {PROMISES.map((promise) => (
                <Badge key={promise} pill bg="success">
                  {promise}
                </Badge>
              ))}
            </div>
          </PagePanel>
        </Col>
        <Col md={6}>
          <PagePanel title="Spread the word" className="h-100 rise rise-5">
            <p className="mb-0">
              <strong>This community only grows with your help.</strong> Without
              players there is no community, and a strategy game is only as good
              as the people you can play it with. If you enjoy Annex, please
              help us spread the word: invite your friends to play, share the
              game with your own communities, and post about it on social media.
              Share your best conquests, your custom maps and your favorite
              moments, and tag us. Every invite and every post brings new
              players to the table.
            </p>
          </PagePanel>
        </Col>
        <Col md={6}>
          <PagePanel title="Join the team" className="h-100 rise rise-5">
            <p className="mb-0">
              Annex is built by a small team, and we need more hands. If you are
              an expert in <strong>sound design or music</strong>,{' '}
              <strong>art</strong>, <strong>animation</strong>,{' '}
              <strong>graphic design</strong>,{' '}
              <strong>coding and software engineering</strong>, or{' '}
              <strong>marketing, PR and social media management</strong>, you
              are very welcome to contribute. Whether you want to help once or
              stay for the long run, we would love to hear from you. Get in
              touch on Discord or any of the social channels in the footer.
            </p>
          </PagePanel>
        </Col>
      </Row>
    </Container>
  );
}

export default About;
