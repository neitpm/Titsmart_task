import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MonthlyPayrollItem } from '../../types';
import { formatVND } from '../../utils/payrollCalculator';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { PayrollDisputeModal } from './PayrollDisputeModal';

interface PayrollSlipViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollItem: MonthlyPayrollItem;
  onUpdatePayroll: (updated: MonthlyPayrollItem) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  canSign?: boolean;
}

export const PayrollSlipViewModal: React.FC<PayrollSlipViewModalProps> = ({
  isOpen,
  onClose,
  payrollItem,
  onUpdatePayroll,
  showToast,
  canSign = true,
}) => {
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const isSigned = payrollItem.signatureStatus === 'signed';
  const isDisputed = payrollItem.signatureStatus === 'disputed';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="PHIẾU LƯƠNG & BẢNG CHẤM CÔNG THÁNG" size="xl">
        <div className="space-y-4 print:space-y-2">
          {/* Print Styles helper */}
          <div className="flex items-center justify-between no-print border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${
                isSigned
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : isDisputed
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300'
              }`}>
                <span className="material-symbols-outlined text-[15px]">
                  {isSigned ? 'verified' : isDisputed ? 'warning' : 'hourglass_top'}
                </span>
                {isSigned ? 'Đã ký xác nhận' : isDisputed ? 'Có khiếu nại' : 'Chờ ký xác nhận'}
              </span>

              {isSigned && payrollItem.signedAt && (
                <span className="text-[11px] text-slate-500">
                  Ký ngày {new Date(payrollItem.signedAt).toLocaleString('vi-VN')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                In phiếu A4
              </button>

              {canSign && !isSigned && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsDisputeModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    Phản hồi
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">draw</span>
                    Ký xác nhận
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Phiếu in ấn chuẩn định dạng A4 */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-xs print:border-none print:shadow-none print:p-0">
            {/* Header doanh nghiệp */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-blue-900 uppercase tracking-wider">CÔNG TY CỔ PHẦN TITSMART</h3>
                <p className="text-[11px] text-slate-500">Hệ thống Quản lý Kỹ thuật & Thi công Công trình</p>
                <p className="text-[10px] text-slate-400">Trụ sở: TP. Hồ Chí Minh | Website: titsmart.vn</p>
              </div>
              <div className="text-right">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
                  PHIẾU THANH TOÁN TIỀN LƯƠNG
                </h2>
                <p className="text-xs font-bold text-primary">
                  Tháng {payrollItem.month} / Năm {payrollItem.year}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Mã số: {payrollItem.id}</p>
              </div>
            </div>

            {/* Thông tin nhân viên */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl mb-4 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Họ và tên:</span>
                <span className="font-extrabold text-slate-900">{payrollItem.userName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Mã nhân viên:</span>
                <span className="font-bold text-slate-800">{payrollItem.userCode || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Chức danh / Vị trí:</span>
                <span className="font-bold text-slate-800">{payrollItem.userTitle || 'Kỹ sư'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Bộ phận / Phòng ban:</span>
                <span className="font-bold text-slate-800">{payrollItem.department || 'Phòng Kỹ thuật'}</span>
              </div>
            </div>

            {/* PHẦN 1: BẢNG TỔNG HỢP CHẤM CÔNG */}
            <div className="mb-4">
              <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wide mb-2 flex items-center gap-1.5 border-b pb-1">
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                I. TỔNG HỢP CHẤM CÔNG TRONG THÁNG
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 text-[10.5px] block">Công chuẩn:</span>
                  <span className="font-extrabold text-slate-800 text-sm">{payrollItem.standardWorkingDays}</span>
                </div>
                <div className="p-2 rounded-lg border border-blue-200 bg-blue-50/50">
                  <span className="text-blue-700 text-[10.5px] block font-medium">Công thực tế:</span>
                  <span className="font-extrabold text-blue-900 text-sm">{payrollItem.actualWorkingDays}</span>
                </div>
                <div className="p-2 rounded-lg border border-amber-200 bg-amber-50/50">
                  <span className="text-amber-800 text-[10.5px] block font-medium">Tại công trường:</span>
                  <span className="font-extrabold text-amber-900 text-sm">{payrollItem.fieldWorkDays}</span>
                </div>
                <div className="p-2 rounded-lg border border-purple-200 bg-purple-50/50">
                  <span className="text-purple-800 text-[10.5px] block font-medium">Đi công tác:</span>
                  <span className="font-extrabold text-purple-900 text-sm">{payrollItem.remoteWorkDays}</span>
                </div>
                <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <span className="text-emerald-800 text-[10.5px] block font-medium">Phép năm (hưởng lương):</span>
                  <span className="font-extrabold text-emerald-900 text-sm">{payrollItem.paidLeaveDays}</span>
                </div>
                <div className="p-2 rounded-lg border border-slate-200 bg-white">
                  <span className="text-slate-500 text-[10.5px] block">Nghỉ không lương (KP):</span>
                  <span className="font-extrabold text-slate-700 text-sm">{payrollItem.unpaidLeaveDays}</span>
                </div>
              </div>

              {/* Giờ làm thêm */}
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg flex items-center justify-between">
                <span>
                  <b>Làm thêm giờ (OT):</b> Ngày thường: <b>{payrollItem.otHoursNormal}h</b> (1.5x) | Chủ nhật: <b>{payrollItem.otHoursSunday}h</b> (2.0x) | Lễ: <b>{payrollItem.otHoursHoliday}h</b> (3.0x)
                </span>
                <span className="text-slate-500">
                  Đi trễ: <b>{payrollItem.lateTimes}</b> lần | Về sớm: <b>{payrollItem.earlyTimes}</b> lần
                </span>
              </div>
            </div>

            {/* PHẦN 2: BẢNG KÊ TIỀN LƯƠNG & THU NHẬP */}
            <div className="mb-4">
              <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wide mb-2 flex items-center gap-1.5 border-b pb-1">
                <span className="material-symbols-outlined text-[16px] text-primary">payments</span>
                II. CHI TIẾT TIỀN LƯƠNG, PHỤ CẤP & KHẤU TRỪ
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CỘT THU NHẬP */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-800 border-b border-slate-200 flex justify-between">
                    <span>A. CÁC KHOẢN THU NHẬP</span>
                    <span>SỐ TIỀN (VNĐ)</span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-600">1. Lương cơ bản theo HĐLĐ:</span>
                      <span className="font-medium text-slate-800">{formatVND(payrollItem.baseSalary)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100 font-bold text-blue-900">
                      <span>2. Lương theo ngày công thực tế ({payrollItem.actualWorkingDays} ngày):</span>
                      <span>{formatVND(payrollItem.salaryByWorkDays)}</span>
                    </div>
                    {payrollItem.paidLeaveSalary > 0 && (
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100 text-emerald-700">
                        <span>3. Lương ngày phép có lương ({payrollItem.paidLeaveDays} ngày):</span>
                        <span>{formatVND(payrollItem.paidLeaveSalary)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-600">4. Phụ cấp ăn trưa:</span>
                      <span className="font-medium text-slate-800">{formatVND(payrollItem.allowanceLunch)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-600">5. Phụ cấp xăng xe / đi lại:</span>
                      <span className="font-medium text-slate-800">{formatVND(payrollItem.allowanceFuel)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-600">6. Phụ cấp điện thoại:</span>
                      <span className="font-medium text-slate-800">{formatVND(payrollItem.allowancePhone)}</span>
                    </div>
                    {payrollItem.allowanceField > 0 && (
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100 font-medium text-amber-800">
                        <span>7. Phụ cấp công trường ({payrollItem.fieldWorkDays} ngày):</span>
                        <span>{formatVND(payrollItem.allowanceField)}</span>
                      </div>
                    )}
                    {payrollItem.otPay > 0 && (
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100 font-bold text-indigo-700">
                        <span>8. Tiền làm thêm giờ (OT):</span>
                        <span>{formatVND(payrollItem.otPay)}</span>
                      </div>
                    )}
                    {payrollItem.bonus > 0 && (
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100 font-bold text-emerald-700">
                        <span>9. Thưởng hiệu quả / dự án:</span>
                        <span>{formatVND(payrollItem.bonus)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-blue-900 text-sm">
                      <span>TỔNG THU NHẬP (GROSS):</span>
                      <span>{formatVND(payrollItem.grossIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* CỘT KHẤU TRỪ */}
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-800 border-b border-slate-200 flex justify-between">
                      <span>B. CÁC KHOẢN KHẤU TRỪ</span>
                      <span>SỐ TIỀN (VNĐ)</span>
                    </div>
                    <div className="p-3 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                        <span className="text-slate-600">1. BHXH, BHYT, BHTN (10.5%):</span>
                        <span className="font-medium text-red-600">-{formatVND(payrollItem.deductionSocialInsurance)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                        <span className="text-slate-600">2. Thuế TNCN (tạm tính):</span>
                        <span className="font-medium text-red-600">-{formatVND(payrollItem.deductionTax)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                        <span className="text-slate-600">3. Tạm ứng đã nhận:</span>
                        <span className="font-medium text-red-600">-{formatVND(payrollItem.deductionAdvance)}</span>
                      </div>
                      {payrollItem.deductionOther > 0 && (
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                          <span className="text-slate-600">4. Giảm trừ khác:</span>
                          <span className="font-medium text-red-600">-{formatVND(payrollItem.deductionOther)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-slate-200 font-extrabold text-red-700 text-sm">
                        <span>TỔNG KHẤU TRỪ:</span>
                        <span>-{formatVND(payrollItem.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* THỰC LĨNH BOX */}
                  <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white m-3 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">
                        THỰC LĨNH TIỀN LƯƠNG:
                      </span>
                      <span className="text-xs opacity-80">(Chuyển khoản tài khoản cá nhân)</span>
                    </div>
                    <span className="text-xl font-black tracking-tight">
                      {formatVND(payrollItem.netSalary)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* PHẦN 3: CHỮ KÝ ĐIỆN TỬ BA BÊN */}
            <div className="pt-4 border-t-2 border-slate-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                {/* 1. Người lao động */}
                <div className="flex flex-col items-center justify-between min-h-[160px] p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase">NGƯỜI LAO ĐỘNG</h5>
                    <p className="text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
                  </div>

                  <div className="my-2 flex flex-col items-center justify-center min-h-[70px]">
                    {isSigned && payrollItem.signatureImage ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={payrollItem.signatureImage}
                          alt="Chữ ký người lao động"
                          className="max-h-16 max-w-[160px] object-contain drop-shadow-xs"
                        />
                        <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-1">
                          Đã ký số: {payrollItem.signedAt ? new Date(payrollItem.signedAt).toLocaleDateString('vi-VN') : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-xs text-amber-600 font-bold block">Chưa ký xác nhận</span>
                        {canSign && (
                          <button
                            type="button"
                            onClick={() => setIsSignModalOpen(true)}
                            className="mt-1.5 px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-lg shadow-xs hover:bg-blue-800 transition cursor-pointer no-print"
                          >
                            ✍️ Ký xác nhận
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-extrabold text-slate-800">
                    {payrollItem.userName}
                  </span>
                </div>

                {/* 2. Kế toán trưởng */}
                <div className="flex flex-col items-center justify-between min-h-[160px] p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase">NGƯỜI LẬP BIỂU / KẾ TOÁN</h5>
                    <p className="text-[10px] text-slate-400 italic">(Ký, họ tên)</p>
                  </div>

                  <div className="my-2 flex flex-col items-center justify-center min-h-[70px]">
                    <span className="text-sm font-serif italic text-blue-900 font-bold">Kế toán tiền lương</span>
                    <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 mt-1">
                      Đã đối soát số liệu
                    </span>
                  </div>

                  <span className="text-xs font-extrabold text-slate-800">Bộ phận Kế toán</span>
                </div>

                {/* 3. Giám đốc duyệt */}
                <div className="flex flex-col items-center justify-between min-h-[160px] p-2 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase">GIÁM ĐỐC DUYỆT</h5>
                    <p className="text-[10px] text-slate-400 italic">(Ký, đóng dấu)</p>
                  </div>

                  <div className="my-2 flex flex-col items-center justify-center min-h-[70px]">
                    <div className="w-12 h-12 rounded-full border-2 border-red-500/80 text-red-600 flex items-center justify-center text-[9px] font-black uppercase text-center leading-tight rotate-[-12deg] shadow-xs">
                      TITSMART<br/>ĐÃ DUYỆT
                    </div>
                  </div>

                  <span className="text-xs font-extrabold text-slate-800">Ban Giám Đốc</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal vẽ chữ ký tay */}
      {isSignModalOpen && (
        <DigitalSignatureModal
          isOpen={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
          payrollItem={payrollItem}
          onSuccess={(updated) => {
            onUpdatePayroll(updated);
            setIsSignModalOpen(false);
          }}
          showToast={showToast}
        />
      )}

      {/* Modal phản hồi khiếu nại */}
      {isDisputeModalOpen && (
        <PayrollDisputeModal
          isOpen={isDisputeModalOpen}
          onClose={() => setIsDisputeModalOpen(false)}
          payrollItem={payrollItem}
          onSuccess={(updated) => {
            onUpdatePayroll(updated);
            setIsDisputeModalOpen(false);
          }}
          showToast={showToast}
        />
      )}
    </>
  );
};
