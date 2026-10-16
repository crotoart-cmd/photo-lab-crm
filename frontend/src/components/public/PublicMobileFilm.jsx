import { LAB_PHOTO } from '../../data/publicLabPhotos';
import { PATH } from '../../config/publicPaths';
import PublicFilmIntakeForm from './PublicFilmIntakeForm';
import { usePublicLocale } from './PublicLocale';
import {
  PublicMobileGroup,
  PublicMobilePage,
  PublicMobileRowLink,
  PublicMobileTitle,
} from './PublicMobilePage';

export default function PublicMobileFilm() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage>
      <PublicMobileTitle title={t('mpage.startFilm')} spec="135 / 120 · C-41 / B&W / E-6" />
      <div className="pm-film-window"><img src={LAB_PHOTO.bench} alt="" /><span><small>{t('mhome.metric.speed')}</small><b>{t('time.2w')}</b><small>{t('exp.labConfirm')}</small></span></div>
      <PublicFilmIntakeForm compact />
      <PublicMobileGroup>
        <PublicMobileRowLink to="/scan" title={t('nav.scan')} hint={t('mhome.card.scanSub')} />
        <PublicMobileRowLink to="/toc-do" title={t('nav.speed')} hint={t('time.2w')} />
        <PublicMobileRowLink to="/in-analog" title={t('nav.print')} hint={t('svc.in-analog.caption')} />
        <PublicMobileRowLink to={PATH.repair} title={t('nav.repair')} hint={t('mhome.card.repairSub')} />
      </PublicMobileGroup>
    </PublicMobilePage>
  );
}
