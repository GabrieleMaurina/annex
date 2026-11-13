const BACKGROUNDS = ['map', 'hex', 'topographic', 'blueprint', 'steel'];

const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

function PageBackground({ centered }: { centered: boolean }) {
  return (
    <div
      className={`page-background page-background-${background}${centered ? ' page-background-centered' : ''}`}
    />
  );
}

export default PageBackground;
