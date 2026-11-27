import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { deleteStorageFiles, uploadAttachment } from '../../utils/fileUploadHelper';

interface FileUploadProps {
  label?: string;
  name?: string;
  value?: string | string[];
  onChange?: (urls: string | string[]) => void;
  className?: string;
  multiple?: boolean;
  onUploadStateChange?: (isUploading: boolean) => void;
  buttonText?: string;
  buttonIcon?: string;
  variant?: 'light' | 'solid';
  enableCameraOption?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  name, 
  value: initialValue, 
  onChange, 
  className = '', 
  multiple = false, 
  onUploadStateChange, 
  buttonText = 'Tải lên tệp', 
  buttonIcon = 'upload', 
  variant = 'light',
  enableCameraOption = true
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Normalize initialValue to array for internal state
  const getInitialArray = () => {
    if (!initialValue) return [];
    if (Array.isArray(initialValue)) return initialValue;
    return [initialValue];
  };
  
  const [localValues, setLocalValues] = useState<string[]>(getInitialArray());

  React.useEffect(() => {
    setLocalValues(getInitialArray());
  }, [initialValue]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setError('');
      setIsUploading(true);
      if (onUploadStateChange) onUploadStateChange(true);
      
      const newUrls: string[] = [];
      const filesToUpload = multiple ? Array.from(event.target.files) : [event.target.files[0]];
      
      for (const file of filesToUpload) {
        try {
          const res = await uploadAttachment(file, 'documents');
          if (res?.url) {
            newUrls.push(res.url);
          }
        } catch (uploadError: any) {
          console.warn("FileUpload warning:", uploadError);
          setError(`Lỗi tải file: ${uploadError.message || 'Không thể tải file'}.`);
        }
      }
      
      const updatedValues = multiple ? [...localValues, ...newUrls] : [newUrls[0]];
      setLocalValues(updatedValues);
      
      if (onChange) {
        if (multiple) {
          onChange(updatedValues);
        } else {
          onChange(newUrls[0]);
        }
      }
    } catch (error) {
      console.error('Lỗi khi tải file:', error);
      setError('Đã xảy ra lỗi khi tải file lên.');
    } finally {
      setIsUploading(false);
      if (onUploadStateChange) onUploadStateChange(false);
    }
  };

  const handleRemove = (indexToRemove: number) => {
    const removedUrl = localValues[indexToRemove];
    const newValues = localValues.filter((_, idx) => idx !== indexToRemove);
    setLocalValues(newValues);
    if (removedUrl) {
      deleteStorageFiles([removedUrl]);
    }
    if (onChange) {
      onChange(multiple ? newValues : newValues[0] || '');
    }
  };

  return (
    <div className={className}>
      {label && <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>}
      {name && <input type="hidden" name={name} value={multiple ? localValues.join(',') : localValues[0] || ''} />}
      
      <div className="flex flex-col gap-2">
        <div className="relative inline-block">
          {enableCameraOption ? (
            <>
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                disabled={isUploading}
                className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 font-bold text-xs rounded-lg transition-all ${
                  variant === 'solid'
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-xs'
                    : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 shadow-2xs'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="material-symbols-outlined text-[17px]">{buttonIcon}</span>
                <span>{buttonText}</span>
                <span className="material-symbols-outlined text-[15px] opacity-70">expand_more</span>
              </button>

              {/* Popover Menu: Chụp ảnh mới / Chọn từ thư viện */}
              {showAttachMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 flex flex-col gap-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false);
                        cameraInputRef.current?.click();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-emerald-600 text-lg">photo_camera</span>
                      <span>Chụp ảnh mới</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-900 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-blue-600 text-lg">image</span>
                      <span>Chọn từ thư viện / File</span>
                    </button>
                  </div>
                </>
              )}

              {/* Hidden inputs cho chụp camera và chọn file */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUpload}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                multiple={multiple}
                className="hidden"
                onChange={handleUpload}
              />
            </>
          ) : (
            <label className={`cursor-pointer relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 font-semibold text-sm rounded-lg transition-all ${variant === 'solid' ? 'bg-primary text-white hover:bg-primary/90 shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="material-symbols-outlined text-[18px]">{buttonIcon}</span>
              {buttonText}
              <input 
                type="file" 
                accept="*/*"
                multiple={multiple}
                onChange={handleUpload}
                disabled={isUploading}
                className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] opacity-0 cursor-pointer"
              />
            </label>
          )}
        </div>
        
        {localValues.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {localValues.map((url, idx) => {
              const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
              return (
                <div key={idx} className="relative group shrink-0 w-16 h-16 rounded border bg-slate-100 overflow-hidden flex items-center justify-center">
                  <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full">
                    {isImage ? (
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-primary bg-white group-hover:bg-slate-50 transition-colors">
                        <span className="material-symbols-outlined text-2xl">description</span>
                        <span className="text-[8px] font-bold mt-1 text-center line-clamp-1 w-full px-1">Tệp đính kèm</span>
                      </div>
                    )}
                  </a>
                  <button 
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow-sm text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                    title="Xóa tệp"
                  >
                    <span className="material-symbols-outlined text-[14px] block">close</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {isUploading && <p className="text-xs text-blue-600 mt-1">Đang tải tệp lên...</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
