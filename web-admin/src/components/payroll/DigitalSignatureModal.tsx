import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { MonthlyPayrollItem } from '../../types';
import { api } from '../../services/apiSupabase';
import { formatVND } from '../../utils/payrollCalculator';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollItem: MonthlyPayrollItem;
  onSuccess: (updated: MonthlyPayrollItem) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  payrollItem,
  onSuccess,
  showToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signMode, setSignMode] = useState<'draw' | 'quick'>('draw');
  const [penColor, setPenColor] = useState<string>('#1e3a8a'); // Xanh mực bút ký truyền thống
  const [isAgreed, setIsAgreed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup canvas resolution and styling
  useEffect(() => {
    if (!isOpen || signMode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Thiết lập kích thước thực của canvas
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Vẽ nền mờ có đường kẻ ngang hướng dẫn ký
    drawGuidelines(ctx, rect.width, rect.height);
  }, [isOpen, signMode, penColor]);

  const drawGuidelines = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Đường kẻ chấm gạch cho chữ ký
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, height * 0.72);
    ctx.lineTo(width - 30, height * 0.72);
    ctx.stroke();

    // Dấu X nhỏ ở đầu dòng
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('✕ Ký tại đây', 30, height * 0.88);
    ctx.restore();
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawGuidelines(ctx, rect.width, rect.height);
    setHasDrawn(false);
  };

  // Tạo chữ ký điện tử nhanh dạng SVG -> Data URL
  const generateQuickSignatureDataUrl = () => {
    const name = payrollItem.userName || 'Nhân viên';
    const now = new Date().toLocaleString('vi-VN');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="150" viewBox="0 0 400 150">
        <rect width="100%" height="100%" fill="none" />
        <text x="200" y="65" font-family="'Brush Script MT', cursive, 'Segoe Script', sans-serif" font-size="34" font-weight="bold" fill="${penColor}" text-anchor="middle">${name}</text>
        <line x1="60" y1="90" x2="340" y2="90" stroke="${penColor}" stroke-width="1.5" stroke-dasharray="4,4" />
        <text x="200" y="112" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">Đã xác thực điện tử: ${payrollItem.userCode || payrollItem.userId}</text>
        <text x="200" y="130" font-family="sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Thời gian: ${now}</text>
      </svg>
    `;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };

  const handleConfirmSignature = async () => {
    if (!isAgreed) {
      showToast?.('Vui lòng tích chọn cam kết xác nhận số liệu trước khi ký!', 'warning');
      return;
    }

    let signatureImage = '';
    if (signMode === 'draw') {
      if (!hasDrawn || !canvasRef.current) {
        showToast?.('Vui lòng vẽ chữ ký của bạn lên khung ký bên dưới!', 'warning');
        return;
      }
      signatureImage = canvasRef.current.toDataURL('image/png');
    } else {
      signatureImage = generateQuickSignatureDataUrl();
    }

    setIsSubmitting(true);
    try {
      // 1. Lưu hoặc đảm bảo phiếu lương đã được tạo trước khi ký
      let activeItem = payrollItem;
      if (!payrollItem.id || payrollItem.id.startsWith('temp-')) {
        activeItem = await api.payroll.save(payrollItem, payrollItem.userName);
      }

      // 2. Ký xác nhận
      const signed = await api.payroll.sign(activeItem.id, {
        signatureImage,
        signatureType: signMode,
        signedByName: payrollItem.userName,
        signedByUserId: payrollItem.userId,
      });

      showToast?.('Ký xác nhận bảng chấm công và bảng lương thành công!', 'success');
      onSuccess(signed);
      onClose();
    } catch (err: any) {
      console.error('[Sign] Lỗi ký xác nhận:', err);
      showToast?.('Lỗi ký xác nhận: ' + (err.message || 'Không thể lưu chữ ký'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="KÝ XÁC NHẬN BẢNG CÔNG & BẢNG LƯƠNG" size="md">
      <div className="space-y-4">
        {/* Tóm tắt thông tin tháng ký */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between border-b border-blue-200/70 pb-2 mb-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Kỳ thanh toán:</span>
              <h4 className="text-sm font-extrabold text-slate-800">
                Tháng {payrollItem.month}/{payrollItem.year}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium">Người lao động:</span>
              <p className="text-xs font-bold text-slate-900">{payrollItem.userName} {payrollItem.userCode ? `(${payrollItem.userCode})` : ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/80 p-2 rounded-md border border-blue-100">
              <span className="text-slate-500 block text-[11px]">Công thực tế / Chuẩn:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {payrollItem.actualWorkingDays} <span className="text-xs text-slate-400 font-normal">/ {payrollItem.standardWorkingDays} công</span>
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-md border border-blue-100">
              <span className="text-slate-500 block text-[11px]">Thực lĩnh (Net):</span>
              <span className="font-extrabold text-emerald-600 text-sm">
                {formatVND(payrollItem.netSalary)}
              </span>
            </div>
          </div>
        </div>

        {/* Chuyển đổi phương thức ký */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">draw</span>
              Chữ ký người lao động:
            </label>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSignMode('draw')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  signMode === 'draw' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vẽ tay
              </button>
              <button
                type="button"
                onClick={() => setSignMode('quick')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  signMode === 'quick' ? 'bg-white text-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ký nhanh điện tử
              </button>
            </div>
          </div>

          {signMode === 'draw' ? (
            <div className="space-y-1.5">
              <div className="relative border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-slate-50/60 touch-none">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair block"
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/90 hover:bg-white text-slate-600 border border-slate-200 rounded text-[11px] font-bold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  Vẽ lại
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Dùng chuột hoặc ngón tay để vẽ chữ ký của bạn</span>
                <div className="flex items-center gap-1.5">
                  <span>Màu mực:</span>
                  <button
                    type="button"
                    onClick={() => setPenColor('#1e3a8a')}
                    className={`w-4 h-4 rounded-full bg-blue-900 border ${penColor === '#1e3a8a' ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    title="Mực xanh truyền thống"
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor('#0f172a')}
                    className={`w-4 h-4 rounded-full bg-slate-900 border ${penColor === '#0f172a' ? 'ring-2 ring-slate-800 ring-offset-1' : ''}`}
                    title="Mực đen"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[176px] text-center">
              <div className="text-2xl font-bold italic text-blue-900 font-serif tracking-wide border-b-2 border-dotted border-blue-900 pb-2 px-6">
                {payrollItem.userName}
              </div>
              <div className="text-[11px] text-slate-500 mt-2 font-medium">
                Xác thực số hóa tài khoản: <span className="font-bold text-slate-700">{payrollItem.userCode || payrollItem.userId}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Thời gian: {new Date().toLocaleString('vi-VN')}
              </div>
            </div>
          )}
        </div>

        {/* Cam kết của người lao động */}
        <label className="flex items-start gap-2.5 p-3 rounded-md border border-slate-200 bg-slate-50/70 cursor-pointer hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={isAgreed}
            onChange={e => setIsAgreed(e.target.checked)}
            className="mt-0.5 accent-primary h-4 w-4 rounded"
          />
          <span className="text-xs text-slate-600 leading-relaxed select-none">
            Tôi xác nhận đã kiểm tra kỹ số ngày công, phụ cấp và số tiền thực lĩnh. Tôi xác nhận số liệu trên là chính xác và đồng ý ký xác nhận.
          </span>
        </label>

        {/* Nút thao tác */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmSignature}
            disabled={isSubmitting || !isAgreed || (signMode === 'draw' && !hasDrawn)}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-md text-xs shadow-xs transition cursor-pointer"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">verified</span>
            )}
            Xác nhận Ký tên
          </button>
        </div>
      </div>
    </Modal>
  );
};
