import { LAB_PHOTO } from '../../data/publicLabPhotos';
import { SPEED_STANDARD } from '../../data/publicLabServices';
import { usePublicLocale } from './PublicLocale';
import {
  PublicMobileBanner,
  PublicMobileCta,
  PublicMobileGroup,
  PublicMobilePage,
  PublicMobileStat,
  PublicMobileTitle,
} from './PublicMobilePage';

const TIME_KEY = { '2 tuần': 'time.2w' };

export function PublicMobileScan() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('scan.h1')} spec={t('scan.lede')} />
      <PublicMobileBanner src={LAB_PHOTO.scan} tone="scan" />
      <PublicMobileGroup>
        <PublicMobileStat title={t('scan.hiH')} hint={t('mpage.hiend')} />
        <PublicMobileStat title={t('scan.batchH')} hint={t('mpage.batch')} />
        <PublicMobileStat title="Size M" hint="Noritsu · Frontier" />
      </PublicMobileGroup>
      <p className="ps-mnote">{t('scan.hiN')}</p>
      <PublicMobileCta to="/film" fill>
        {t('home.doorFilm')}
      </PublicMobileCta>
    </PublicMobilePage>
  );
}

export function PublicMobilePrint() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('print.h1')} spec={t('print.lede')} />
      <PublicMobileBanner src={LAB_PHOTO.print} tone="print" />
      <PublicMobileGroup>
        <PublicMobileStat title={t('print.h2')} hint={t('mpage.durst')} />
        <PublicMobileStat title={t('mpage.printSize')} hint="135 — 13 × 18 cm" />
      </PublicMobileGroup>
      <p className="ps-mnote">{t('print.p')}</p>
      <PublicMobileCta to="/film" fill>
        {t('home.doorFilm')}
      </PublicMobileCta>
    </PublicMobilePage>
  );
}

export function PublicMobileSpeed() {
  const { t } = usePublicLocale();
  const time = (raw) => t(TIME_KEY[raw] || raw);
  return (
    <PublicMobilePage back="/">
      <PublicMobileTitle title={t('speed.h1')} spec={t('speed.lede')} />
      <PublicMobileBanner src={LAB_PHOTO.speed} tone="speed" />
      <PublicMobileGroup>
        {SPEED_STANDARD.map((row) => (
          <PublicMobileStat key={row.process} title={row.process} hint={time(row.time)} />
        ))}
      </PublicMobileGroup>
      <p className="ps-mnote">{t('speed.sunday')}</p>
      <p className="ps-mnote">{t('speed.neg')}</p>
      <p className="ps-mnote">{t('speed.link')}</p>
      <p className="ps-mnote">{t('speed.print')}</p>
      <p className="ps-mnote">{t('speed.rushOff')}</p>
      <PublicMobileCta to="/film" fill>
        {t('home.doorFilm')}
      </PublicMobileCta>
    </PublicMobilePage>
  );
}
