import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { 
  AttendanceConfig, 
  AttendanceMode, 
  GpsRequirement, 
  WorkShift, 
  AttendanceGpsLocation 
} from '../../types';

interface AttendanceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AttendanceConfig;
  onSave: (newConfig: AttendanceConfig) => Promise<void>;
}

export const AttendanceConfigModal: React.FC<AttendanceConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'mode' | 'shifts' | 'gps'>('mode');
  const [formConfig, setFormConfig] = useState<AttendanceConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);

  // State cho thêm / sửa ca
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);

  // State cho thêm / sửa địa điểm GPS
  const [editingLoc, setEditingLoc] = useState<AttendanceGpsLocation | null>(null);
  const [showLocModal, setShowLocModal] = useState(false);

  React.useEffect(() => {
    setFormConfig(config);
  }, [config, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formConfig);
      onClose();
    } catch (e: any) {
      alert('Lỗi lưu cấu hình: ' + (e.message || 'Không thể lưu'));
    } finally {
      setIsSaving(false);
    }
  };

  // Lấy vị trí GPS hiện tại cho địa điểm đang tạo/sửa
  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị GPS');
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGps(false);
        if (editingLoc) {
          setEditingLoc({
            ...editingLoc,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          });
        }
      },
      (err) => {
        setIsGettingGps(false);
        alert('Không thể lấy tọa độ GPS: ' + (err.message || 'Vui lòng cấp quyền truy cập vị trí'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cài đặt hình thức chấm công (Admin Setup)"
      size="xl"
      icon="tune"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('mode')}
            className={`flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mode'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Hình thức & Quy định
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'shifts'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            Ca làm việc ({formConfig.shifts?.filter(s => s.isActive).length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gps')}
            className={`flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'gps'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">location_on</span>
            Địa điểm GPS ({formConfig.locations?.filter(l => l.isActive).length || 0})
          </button>
        </div>

        {/* TAB 1: HÌNH THỨC & QUY ĐỊNH */}
        {activeTab === 'mode' && (
          <div className="space-y-5 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                1. Loại hình thức chấm công chính:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setFormConfig({ ...formConfig, mode: 'time' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.mode === 'time'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">timer</span>
                    Theo thời gian
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Chấm công tự do theo giờ vào - giờ ra. Tính thời lượng thực tế trong ngày.
                  </p>
                </div>

                <div
                  onClick={() => setFormConfig({ ...formConfig, mode: 'shift' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.mode === 'shift'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">calendar_view_day</span>
                    Theo ca làm việc
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nhân viên chọn ca (hoặc hệ thống khớp ca). Tự động tính đúng giờ, đi trễ, về sớm.
                  </p>
                </div>

                <div
                  onClick={() => setFormConfig({ ...formConfig, mode: 'hybrid' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.mode === 'hybrid'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                    Kết hợp linh hoạt
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hỗ trợ song song cả chấm theo giờ tự do và chấm chọn ca làm việc.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                2. Quy định Định vị vị trí GPS:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setFormConfig({ ...formConfig, gpsRequirement: 'none' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.gpsRequirement === 'none'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">location_off</span>
                    Không yêu cầu GPS
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Cho phép chấm công mọi nơi, không kiểm tra hay thu thập vị trí GPS.
                  </p>
                </div>

                <div
                  onClick={() => setFormConfig({ ...formConfig, gpsRequirement: 'record_only' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.gpsRequirement === 'record_only'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">my_location</span>
                    Ghi nhận tọa độ
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Khuyến nghị: Lưu vết tọa độ & khoảng cách để đối soát, không chặn nhân viên.
                  </p>
                </div>

                <div
                  onClick={() => setFormConfig({ ...formConfig, gpsRequirement: 'strict' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    formConfig.gpsRequirement === 'strict'
                      ? 'border-primary bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                    Bắt buộc trong bán kính
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Chỉ cho phép chấm công khi ở đúng trong bán kính công ty / công trường.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Yêu cầu chụp ảnh chân dung (Selfie)</div>
                <div className="text-[11px] text-slate-500">Bắt buộc nhân viên chụp ảnh khuôn mặt khi Check-in</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConfig.requirePhoto}
                  onChange={(e) => setFormConfig({ ...formConfig, requirePhoto: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: CÀI ĐẶT CA LÀM VIỆC */}
        {activeTab === 'shifts' && (
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Thiết lập các ca làm việc chuẩn để nhân viên lựa chọn khi chấm công.
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingShift({
                    id: `shift_${Date.now()}`,
                    name: '',
                    startTime: '08:00',
                    endTime: '17:30',
                    lateGraceMinutes: 15,
                    earlyLeaveGraceMinutes: 15,
                    workWeight: 1.0,
                    description: '',
                    isActive: true,
                  });
                  setShowShiftModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Thêm ca mới
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {(formConfig.shifts || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Chưa có ca làm việc nào. Bấm nút Thêm ca mới để tạo.</div>
              ) : (
                (formConfig.shifts || []).map((shift) => (
                  <div key={shift.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs sm:text-sm ${shift.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {shift.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                          {shift.startTime} - {shift.endTime}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {shift.workWeight} công
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {shift.description || `Cho phép trễ tối đa: ${shift.lateGraceMinutes} phút`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formConfig.shifts.map(s => s.id === shift.id ? { ...s, isActive: !s.isActive } : s);
                          setFormConfig({ ...formConfig, shifts: updated });
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          shift.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {shift.isActive ? 'Bật' : 'Tắt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingShift({ ...shift });
                          setShowShiftModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                        title="Chỉnh sửa ca"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa "${shift.name}"?`)) {
                            setFormConfig({
                              ...formConfig,
                              shifts: formConfig.shifts.filter(s => s.id !== shift.id)
                            });
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Xóa ca"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CÀI ĐẶT ĐỊA ĐIỂM GPS */}
        {activeTab === 'gps' && (
          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Danh sách văn phòng, kho xưởng, công trường hợp lệ để chấm công GPS.
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingLoc({
                    id: `loc_${Date.now()}`,
                    name: '',
                    address: '',
                    latitude: 10.7769,
                    longitude: 106.7009,
                    radiusMeters: 300,
                    isActive: true,
                  });
                  setShowLocModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add_location</span>
                Thêm địa điểm
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {(formConfig.locations || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Chưa có địa điểm nào. Bấm nút Thêm địa điểm để tạo.</div>
              ) : (
                (formConfig.locations || []).map((loc) => (
                  <div key={loc.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-xs sm:text-sm ${loc.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {loc.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Bán kính: {loc.radiusMeters}m
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)} {loc.address ? `• ${loc.address}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formConfig.locations.map(l => l.id === loc.id ? { ...l, isActive: !l.isActive } : l);
                          setFormConfig({ ...formConfig, locations: updated });
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          loc.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {loc.isActive ? 'Bật' : 'Tắt'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLoc({ ...loc });
                          setShowLocModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                        title="Chỉnh sửa địa điểm"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa "${loc.name}"?`)) {
                            setFormConfig({
                              ...formConfig,
                              locations: formConfig.locations.filter(l => l.id !== loc.id)
                            });
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Xóa địa điểm"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 text-xs sm:text-sm cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-blue-800 text-white font-bold rounded-lg disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-sm"
          >
            {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            Lưu cài đặt
          </button>
        </div>
      </div>

      {/* MODAL THÊM / SỬA CA LÀM VIỆC */}
      {showShiftModal && editingShift && (
        <Modal
          isOpen={showShiftModal}
          onClose={() => setShowShiftModal(false)}
          title={editingShift.id.startsWith('shift_') ? 'Cài đặt ca làm việc' : 'Chỉnh sửa ca làm việc'}
          size="md"
          icon="schedule"
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên ca làm việc (*):</label>
              <input
                type="text"
                value={editingShift.name}
                onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                placeholder="Ví dụ: Ca hành chính, Ca sáng..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu (*):</label>
                <input
                  type="time"
                  value={editingShift.startTime}
                  onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc (*):</label>
                <input
                  type="time"
                  value={editingShift.endTime}
                  onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cho phép đi trễ (phút):</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={editingShift.lateGraceMinutes}
                  onChange={(e) => setEditingShift({ ...editingShift, lateGraceMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số công chuẩn:</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="3"
                  value={editingShift.workWeight}
                  onChange={(e) => setEditingShift({ ...editingShift, workWeight: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả / Ghi chú ca:</label>
              <input
                type="text"
                value={editingShift.description || ''}
                onChange={(e) => setEditingShift({ ...editingShift, description: e.target.value })}
                placeholder="Nghỉ trưa 12:00 - 13:30..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingShift.name.trim()) {
                    alert('Vui lòng nhập tên ca làm việc');
                    return;
                  }
                  const existingIdx = formConfig.shifts.findIndex(s => s.id === editingShift.id);
                  let updated: WorkShift[];
                  if (existingIdx >= 0) {
                    updated = [...formConfig.shifts];
                    updated[existingIdx] = editingShift;
                  } else {
                    updated = [...formConfig.shifts, editingShift];
                  }
                  setFormConfig({ ...formConfig, shifts: updated });
                  setShowShiftModal(false);
                }}
                className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL THÊM / SỬA ĐỊA ĐIỂM GPS */}
      {showLocModal && editingLoc && (
        <Modal
          isOpen={showLocModal}
          onClose={() => setShowLocModal(false)}
          title="Cài đặt địa điểm GPS chấm công"
          size="md"
          icon="location_on"
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên địa điểm (*):</label>
              <input
                type="text"
                value={editingLoc.name}
                onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })}
                placeholder="Ví dụ: Trụ sở Công ty, Trạm 110kV Đăk Mil..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] text-slate-500">Lấy tọa độ hiện tại nhanh:</span>
              <button
                type="button"
                onClick={handleGetCurrentGps}
                disabled={isGettingGps}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">my_location</span>
                {isGettingGps ? 'Đang định vị...' : 'Lấy vị trí của tôi'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vĩ độ (Latitude) (*):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={editingLoc.latitude}
                  onChange={(e) => setEditingLoc({ ...editingLoc, latitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kinh độ (Longitude) (*):</label>
                <input
                  type="number"
                  step="0.000001"
                  value={editingLoc.longitude}
                  onChange={(e) => setEditingLoc({ ...editingLoc, longitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bán kính cho phép (mét):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="5000"
                  step="50"
                  value={editingLoc.radiusMeters}
                  onChange={(e) => setEditingLoc({ ...editingLoc, radiusMeters: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-primary focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-500 shrink-0">mét</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Gợi ý: Văn phòng 200m - 300m; Công trường lớn: 500m - 1000m.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ thực tế:</label>
              <input
                type="text"
                value={editingLoc.address || ''}
                onChange={(e) => setEditingLoc({ ...editingLoc, address: e.target.value })}
                placeholder="Số nhà, đường, huyện/tỉnh..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowLocModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingLoc.name.trim()) {
                    alert('Vui lòng nhập tên địa điểm');
                    return;
                  }
                  const existingIdx = formConfig.locations.findIndex(l => l.id === editingLoc.id);
                  let updated: AttendanceGpsLocation[];
                  if (existingIdx >= 0) {
                    updated = [...formConfig.locations];
                    updated[existingIdx] = editingLoc;
                  } else {
                    updated = [...formConfig.locations, editingLoc];
                  }
                  setFormConfig({ ...formConfig, locations: updated });
                  setShowLocModal(false);
                }}
                className="px-4 py-1.5 bg-primary text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
