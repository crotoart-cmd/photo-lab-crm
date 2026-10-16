import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseDeliveryLink } from '../../lib/publicDeliveryLink';
import { usePublicLocale } from './PublicLocale';
import PublicMobileDialog from './PublicMobileDialog';
import PublicMobileIcon from './PublicMobileIcon';

export default function PublicMobileAlbumAccess() {
  const { t, lang } = usePublicLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const close = () => { setOpen(false); setLink(''); setError(''); };
  return (
    <>
      <button type="button" className="pm-home-action" onClick={() => setOpen(true)}><PublicMobileIcon name="photo_library" /><span>{t('exp.yourPhotos')}</span><PublicMobileIcon name="arrow_outward" /></button>
      <PublicMobileDialog open={open} onClose={close} title={t('exp.openAlbum')}>
        <form onSubmit={(event) => {
          event.preventDefault();
          const path = parseDeliveryLink(link);
          if (!path) { setError(t('exp.invalidLink')); return; }
          close();
          navigate(`${path}?lang=${lang}`);
        }}>
          <label className="pm-album-link"><span>{t('exp.albumLink')}</span><input required type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} value={link} onChange={(event) => { setLink(event.target.value); setError(''); }} placeholder="https://…/delivery/…" aria-describedby={error ? 'pm-album-link-error' : undefined} /></label>
          {error ? <p className="pm-error" id="pm-album-link-error" role="alert">{error}</p> : null}
          <button type="submit" className="pm-primary">{t('exp.openAlbum')}<PublicMobileIcon name="arrow_forward" /></button>
        </form>
      </PublicMobileDialog>
    </>
  );
}
