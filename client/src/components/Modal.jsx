import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, z = 'z-50' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 ${z} grid place-items-end bg-black/70 sm:place-items-center`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="safe-b max-h-[88vh] w-full animate-pop overflow-hidden rounded-t-3xl border border-edge bg-panel sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="icon-btn !h-8 !w-8" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="scroll-y max-h-[calc(88vh-64px)] p-5">{children}</div>
      </div>
    </div>
  );
}
