import { ArrowRight, ArrowUpRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePublicLocale, PsLangSwitch } from '../components/public/PublicLocale';
import PublicMobileBrand from '../components/public/PublicMobileBrand';
import { ABOUT_FOUNDERS, publicAboutCopy } from '../lib/publicAbout';
import { PATH } from '../config/publicPaths';
import '../styles/public-about.css';

function FounderPortrait({ founder, eager = false }) {
  return (
    <span className="about-portrait" style={{ '--portrait-width': founder.width, '--portrait-x': founder.x, '--portrait-y': founder.y }}>
      <img src={founder.image} alt={founder.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </span>
  );
}

export default function PublicAbout() {
  const { lang } = usePublicLocale();
  const copy = publicAboutCopy(lang);

  return (
    <div className="public-about" id="about-top">
      <header className="about-mobile-nav ps-mpro-nav">
        <PublicMobileBrand />
        <PsLangSwitch />
      </header>

      <section className="about-intro about-width" aria-labelledby="about-title">
        <p className="about-eyebrow">{copy.label}</p>
        <h1 id="about-title">HDTLabx.</h1>
        <p className="about-tagline">{copy.title}</p>
        <p className="about-lede">{copy.intro}</p>
        <p className="about-people-caption">{copy.people}</p>
        <div className="about-people">
          {ABOUT_FOUNDERS.map((founder, index) => (
            <a key={founder.id} href={`#${founder.id}`} className="about-person-link" aria-label={`${founder.name}: ${copy.founders[index].role}`}>
              <FounderPortrait founder={founder} eager />
              <span className="about-person-name">{founder.name}</span>
              <span className="about-person-role">{founder.letter} / {copy.founders[index].role}</span>
              <span className="about-person-place">{copy.founders[index].place}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="about-story about-width about-section" aria-labelledby="about-story-title">
        <p className="about-eyebrow">{copy.storyLabel}</p>
        <div>
          <h2 id="about-story-title">{copy.storyTitle}</h2>
          <div className="about-prose">{copy.story.map((text) => <p key={text}>{text}</p>)}</div>
        </div>
      </section>

      <section className="about-founders about-width about-section" aria-labelledby="about-founders-title">
        <header className="about-section-head">
          <p className="about-eyebrow">{copy.teamLabel}</p>
          <h2 id="about-founders-title">{copy.teamTitle}</h2>
        </header>
        {ABOUT_FOUNDERS.map((founder, index) => {
          const profile = copy.founders[index];
          return (
            <article className="about-founder" id={founder.id} key={founder.id}>
              <div className="about-founder-identity">
                <span className="about-founder-letter" aria-hidden="true">{founder.letter}</span>
                <h3>{founder.name}</h3>
                <p>{profile.role} <span aria-hidden="true">/</span> {profile.place}</p>
              </div>
              <div className="about-founder-copy">
                <h4>{profile.heading}</h4>
                <div className="about-prose">{profile.paragraphs.map((text) => <p key={text}>{text}</p>)}</div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="about-repair" aria-labelledby="about-repair-title">
        <div className="about-width about-repair-inner">
          <p className="about-eyebrow">{copy.repairLabel}</p>
          <h2 id="about-repair-title">{copy.repairTitle}</h2>
          <div className="about-repair-content">
            <ul className="about-camera-systems">{['Rollei', 'Contax', 'Leica', 'Pentax'].map((name) => <li key={name}>{name}</li>)}</ul>
            <div>
              <div className="about-prose">{copy.repair.map((text) => <p key={text}>{text}</p>)}</div>
              <Link className="about-link about-link--light" to={PATH.repair}>{copy.repairCta}<ArrowUpRight size={20} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="about-principles about-width about-section" aria-labelledby="about-vision-title">
        <p className="about-eyebrow">{copy.principlesLabel}</p>
        <div className="about-principles-content">
          <div className="about-vision">
            <h2 id="about-vision-title">{copy.visionTitle}</h2>
            <p>{copy.vision}</p>
          </div>
          <div className="about-mission">
            <h2>{copy.missionTitle}</h2>
            <ol>
              {copy.missions.map(([title, text], index) => (
                <li key={title}><span className="about-list-number">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>
              ))}
            </ol>
          </div>
          <div className="about-values">
            <h2>{copy.valuesTitle}</h2>
            <dl>{copy.values.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
          </div>
        </div>
      </section>

      <section className="about-close about-width about-section" aria-labelledby="about-close-title">
        <h2 id="about-close-title">{copy.closing}</h2>
        <p>{copy.closingText}</p>
        <div className="about-close-actions">
          <Link className="about-link about-link--primary" to={PATH.film}>{copy.filmCta}<ArrowRight size={20} aria-hidden="true" /></Link>
          <Link className="about-link" to={PATH.contact}>{copy.contactCta}<ArrowUpRight size={20} aria-hidden="true" /></Link>
          <a className="about-back-top" href="#about-top" aria-label={copy.backTop} title={copy.backTop}><ArrowUp size={20} aria-hidden="true" /></a>
        </div>
      </section>
    </div>
  );
}
