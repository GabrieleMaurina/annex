interface Props {
  path: string;
  size?: number;
  alt?: string;
}

function WhiteIcon({ path, size = 16, alt = '' }: Props) {
  const mask = `url(${path})`;
  return (
    <span
      className="icon-mask"
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{
        width: size,
        height: size,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

export default WhiteIcon;
