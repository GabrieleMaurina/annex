interface Props {
  text: string;
  tone: 'victory' | 'defeat';
}

function Stamp({ text, tone }: Props) {
  return (
    <div className={`stamp stamp-${tone}`} aria-hidden="true">
      {text}
    </div>
  );
}

export default Stamp;
