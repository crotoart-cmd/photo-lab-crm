import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { BRAND_NAME } from '../config/brand';
import BrandLogo from '../components/BrandLogo';
import { formatRepairMoney } from '../constants/customerRepair';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

export default function RepairConfirm() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi
      .get(`/repair-public/${token}`)
      .then((res) => setTicket(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Link không hợp lệ'));
  }, [token]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action || !ticket || done) return;
    if (ticket.expired) return;
    submit(action === 'accept' ? 'accept' : 'decline');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, searchParams]);

  const submit = async (action) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await publicApi.post(`/repair-public/${token}`, { action });
      setDone(data.message);
      setTicket((t) => (t ? { ...t, status: data.ticket?.status, status_label: data.status_label } : t));
    } catch (err) {
      setError(err.response?.data?.message || 'Xác nhận thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (error && !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f4f6]">
        <p className="text-red-600 text-center max-w-md">{error}</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f6]">
        <p className="text-slate-500">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#111] text-center py-8 px-4">
            <BrandLogo size="lg" className="items-center mx-auto mb-3" />
            <p className="text-white/80 text-xs uppercase tracking-widest">Báo giá sửa máy</p>
            <p className="text-white text-lg font-semibold mt-2">{BRAND_NAME}</p>
            <p className="text-white/70 text-sm mt-1 font-mono">{ticket.ticket_number}</p>
          </div>
          <div className="p-6 space-y-4">
            {done ? (
              <p className="text-sm text-[var(--color-green)] font-medium text-center">{done}</p>
            ) : ticket.expired ? (
              <p className="text-sm text-red-600 text-center">Link đã hết hạn — vui lòng liên hệ tiệm.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Xin chào <strong>{ticket.customer_name}</strong>, máy{' '}
                  <strong>{ticket.model_name}</strong>
                  {ticket.serial_number ? ` (SN ${ticket.serial_number})` : ''} có báo giá như sau:
                </p>
                <p className="text-2xl font-bold text-center">{formatRepairMoney(ticket.quote_amount)}</p>
                {ticket.quote_note && (
                  <p className="text-sm text-slate-500 border-l-2 border-slate-200 pl-3">{ticket.quote_note}</p>
                )}
                {ticket.deposit_amount > 0 && (
                  <p className="text-xs text-slate-500 text-center">
                    Đã cọc: {formatRepairMoney(ticket.deposit_amount)}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    className="apple-btn-primary flex-1"
                    onClick={() => submit('accept')}
                  >
                    Đồng ý sửa
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    className="apple-btn-secondary flex-1"
                    onClick={() => submit('decline')}
                  >
                    Từ chối
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <p className="text-xs text-slate-400 text-center">Trạng thái: {ticket.status_label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
