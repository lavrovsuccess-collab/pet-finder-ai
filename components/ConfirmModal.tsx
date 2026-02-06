import React, { useEffect, useRef } from 'react';

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  isConfirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  confirmVariant = 'primary',
  isConfirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    // Фокус на подтверждении для клавиатуры (Enter)
    const t = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-label="Закрыть"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>
          ) : null}
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirmLoading}
            className="w-full sm:w-auto px-5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isConfirmLoading}
            className={`w-full sm:w-auto px-5 py-2 rounded-md border border-transparent text-white text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed ${confirmClass}`}
          >
            {isConfirmLoading ? 'Подождите...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

