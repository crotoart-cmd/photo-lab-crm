import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BRAND_NAME } from '../config/brand';
import BrandLogo from '../components/BrandLogo';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export default function DeliveryGallery() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi
      .get(`/delivery/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Không tải được ảnh'));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f4f6]">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f6]">
        <p className="text-slate-500">Đang tải ảnh...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#111] text-center py-8 px-4">
            <BrandLogo size="lg" className="items-center mx-auto mb-3" />
            <p className="text-white/80 text-xs uppercase tracking-widest">Ảnh scan của bạn</p>
            <p className="text-white text-lg font-semibold mt-2">{BRAND_NAME}</p>
            <p className="text-white/70 text-sm mt-1 font-mono">{data.ticketNumber}</p>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              {data.fileCount} ảnh — bấm để xem kích thước lớn hoặc tải về.
            </p>
            {data.files?.length === 0 ? (
              <p className="text-slate-400 text-center py-12">Lab đang tải ảnh lên — vui lòng quay lại sau.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.files.map((file) => (
                  <a
                    key={file.filename}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    {file.url && /\.(jpe?g|png|gif|webp)$/i.test(file.name || file.filename) ? (
                      <img src={file.url} alt={file.name} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="aspect-square flex items-center justify-center bg-slate-100 text-xs p-2 text-center">
                        {file.name}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
