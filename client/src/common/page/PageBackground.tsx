const BACKGROUNDS = ['map', 'hex', 'topographic', 'blueprint', 'steel'];

const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

function PageBackground() {
  return <div className={`page-background page-background-${background}`} />;
}

export default PageBackground;
