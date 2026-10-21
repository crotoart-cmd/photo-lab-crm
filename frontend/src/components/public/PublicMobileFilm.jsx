import { LAB_PHOTO } from '../../data/publicLabPhotos';
import PublicFilmIntakeForm from './PublicFilmIntakeForm';
import PublicMobileFilmServices from './PublicMobileFilmServices';
import { usePublicLocale } from './PublicLocale';
import {
  PublicMobilePage,
  PublicMobileTitle,
} from './PublicMobilePage';

export default function PublicMobileFilm() {
  const { t } = usePublicLocale();
  return (
    <PublicMobilePage>
      <PublicMobileTitle title={t('mpage.startFilm')} spec="135 / 120 · C-41 / B&W / E-6" />
      <div className="pm-film-window"><img src={LAB_PHOTO.bench} alt="" /><span><small>{t('mhome.metric.speed')}</small><b>{t('time.2w')}</b><small>{t('exp.labConfirm')}</small></span></div>
      <PublicFilmIntakeForm compact />
      <PublicMobileFilmServices />
    </PublicMobilePage>
  );
}
