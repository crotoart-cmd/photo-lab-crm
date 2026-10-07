import { customerEmail, customerName, customerPhone, ticketCode } from '../utils/filmLabels';
import BrandLogo from './BrandLogo';
import { BRAND_NAME } from '../config/brand';
import IntakeChecklistView from './IntakeChecklistView';
import { labelOf, FILM_TYPE_DETAILS, PROCESSING_PROCESSES, FILM_FORMATS } from '../utils/intakeOptions';

export default function TicketSlip({ film, onPrint }) {
  const t = ticketCode(film);

  return (
    <div id="ticket-slip-print" className="border-2 border-dashed border-lab-300 rounded-xl p-6 bg-lab-50">
      <div className="text-center border-b border-lab-200 pb-4 mb-4 flex flex-col items-center gap-2">
        <BrandLogo size="lg" className="items-center" />
        <p className="text-sm font-semibold text-lab-900">{BRAND_NAME}</p>
        <p className="text-sm text-slate-600">PHIẾU TIẾP NHẬN FILM</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Mã phiếu</span>
          <span className="font-mono font-bold text-lab-800">{t}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Ngày tiếp nhận</span>
          <span>{new Date(film.receivedAt || film.createdAt).toLocaleString('vi-VN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Khách hàng</span>
          <span className="font-medium">{customerName(film)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Điện thoại</span>
          <span>{customerPhone(film)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Email</span>
          <span className="text-xs">{customerEmail(film)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Số cuộn</span>
          <span className="font-medium">{film.quantity} cuộn</span>
        </div>
        {film.intakeChecklist ? (
          <div className="pt-2 text-xs">
            <p>
              {labelOf(FILM_FORMATS, film.intakeChecklist.filmFormat)} ·{' '}
              {labelOf(FILM_TYPE_DETAILS, film.intakeChecklist.filmTypeDetail)} ·{' '}
              {labelOf(PROCESSING_PROCESSES, film.intakeChecklist.processingProcess)}
            </p>
          </div>
        ) : null}
        <div className="pt-3 border-t border-lab-200">
          <IntakeChecklistView checklist={film.intakeChecklist} />
        </div>
        {film.receptionNotes && (
          <div className="pt-2 border-t">
            <span className="text-slate-500">Ghi chú: </span>
            {film.receptionNotes}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500 text-center">
          Khách sẽ nhận email khi film tráng xong và khi lab xác nhận đã trả ảnh.
        </p>
      </div>

      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          className="mt-4 w-full border border-lab-600 text-lab-700 py-2 rounded-lg text-sm font-medium hover:bg-lab-100"
        >
          In phiếu
        </button>
      )}
    </div>
  );
}
