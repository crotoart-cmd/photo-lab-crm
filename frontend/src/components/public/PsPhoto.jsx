export default function PsPhoto({ src, tone = 'film', className = '', alt = '' }) {
  const box = `${className} ps-photo-box`.trim();
  if (src) {
    return (
      <div className={box}>
        <img src={src} alt={alt} className="ps-photo-img" />
      </div>
    );
  }
  return <div className={`${box} ps-tile-photo ps-tile-photo--${tone}`} aria-hidden />;
}
