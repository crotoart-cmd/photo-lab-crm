import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { RETAIL_DATA_CHANGED } from './seedTestCameras';

export const shopKey = (source, id) => `${source}:${id}`;

export function useShopCatalog() {
  const [items, setItems] = useState(null);

  const reload = useCallback(
    () =>
      api
        .get('/retail/shop-catalog')
        .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => setItems((prev) => prev ?? null)),
    []
  );

  useEffect(() => {
    reload();
    window.addEventListener(RETAIL_DATA_CHANGED, reload);
    return () => window.removeEventListener(RETAIL_DATA_CHANGED, reload);
  }, [reload]);

  const byKey = useMemo(() => {
    const map = new Map();
    for (const row of items || []) map.set(shopKey(row.source, row.id), row);
    return map;
  }, [items]);

  const save = useCallback(async (row, { showOnWeb, description, imagesKept, files }) => {
    const data = new FormData();
    if (showOnWeb !== undefined) data.append('showOnWeb', showOnWeb ? 'true' : 'false');
    if (description !== undefined) data.append('description', description);
    if (imagesKept !== undefined) data.append('imagesKept', JSON.stringify(imagesKept));
    for (const file of files || []) data.append('images', file);
    const { data: res } = await api.patch(
      `/retail/shop-catalog/${row.source}/${encodeURIComponent(row.id)}`,
      data
    );
    if (Array.isArray(res?.items)) setItems(res.items);
    return res;
  }, []);

  const setWeb = useCallback(
    async (rows, showOnWeb) => {
      let last = null;
      for (const row of rows) {
        last = await save(row, { showOnWeb });
      }
      return last;
    },
    [save]
  );

  return { items, online: items !== null, byKey, reload, save, setWeb };
}
