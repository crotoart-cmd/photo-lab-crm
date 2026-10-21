import { LAB_PHOTO } from '../../data/publicLabPhotos';
import { SPEED_STANDARD } from '../../data/publicLabServices';
import { PATH } from '../../config/publicPaths';
import PublicPrintIntakeForm from './PublicPrintIntakeForm';
import PublicScanIntakeForm from './PublicScanIntakeForm';
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
    <PublicMobilePage back={PATH.film}>
      <PublicMobileTitle title={t('scan.h1')} spec={t('scan.howH')} />
      <div className="pm-film-window">
        <img src={LAB_PHOTO.scan} alt="" />
        <span>
          <small>{t('scan.hiH')}</small>
          <b>{t('mpage.hiend')}</b>
          <small>{t('mpage.batch')}</small>
        </span>
      </div>
      <p className="ps-mnote">{t('scan.howP')}</p>
      <PublicScanIntakeForm compact />
    </PublicMobilePage>
  );
}

export function PublicMobilePrint() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage back={PATH.film}>
      <PublicMobileTitle title={t('print.h1')} spec={t('print.howH')} />
      <div className="pm-film-window">
        <img src={LAB_PHOTO.print} alt="" />
        <span>
          <small>{t('print.h2')}</small>
          <b>{t('mpage.durst')}</b>
          <small>{t('mpage.printSize')}</small>
        </span>
      </div>
      <p className="ps-mnote">{t('print.howP')}</p>
      <PublicPrintIntakeForm compact />
    </PublicMobilePage>
  );
}

export function PublicMobileSpeed() {
  const { t } = usePublicLocale();
  const time = (raw) => t(TIME_KEY[raw] || raw);
  return (
    <PublicMobilePage back={PATH.film}>
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
