import React from 'react';
import { ConfirmModal } from './ConfirmModal';

interface AppExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const AppExitConfirmModal: React.FC<AppExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Thoát ứng dụng"
      message="Bạn có chắc chắn muốn thoát khỏi ứng dụng không?"
      confirmText="Thoát"
      cancelText="Ở lại"
      icon="power_settings_new"
      isDestructive={true}
      zIndexClass="z-[999999]"
    />
  );
};
