import { Link } from 'react-router-dom';
import { SERVICE_TILES } from '../data/publicLabServices';

function ServiceTile({ tile }) {
  const inner = (
    <>
      <div className="ps-tile-top">
        <h2>{tile.title}</h2>
        {tile.enabled ? (
          <span className="ps-tile-go" aria-hidden>
            ›
          </span>
        ) : (
          <span className="ps-tile-soon">Sắp mở</span>
        )}
      </div>
      <p>{tile.caption}</p>
    </>
  );

  if (!tile.enabled) {
    return (
      <div className={`ps-tile ps-tile--${tile.tone} ps-tile--disabled`} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link to={tile.to} className={`ps-tile ps-tile--${tile.tone}`}>
      {inner}
    </Link>
  );
}

export default function PublicHome() {
  return (
    <div className="ps-page">
      <section className="ps-stage">
        <div className="ps-stage-inner">
          <h1>Vẫn chụp film. Vẫn gửi lab.</h1>
          <Link to="/film" className="ps-cta ps-cta--on-dark">
            Gửi cuộn →
          </Link>
        </div>
      </section>

      <section className="ps-lab-block">
        <h2 className="ps-lab-heading">Thêm về lab</h2>
        <div className="ps-tiles">
          {SERVICE_TILES.map((tile) => (
            <ServiceTile key={tile.id} tile={tile} />
          ))}
        </div>
      </section>
    </div>
  );
}
