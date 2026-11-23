<<<<<<< HEAD
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Yes, continue', cancelText = 'No, cancel', isDanger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0B2545]/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-[#0B2545]'}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-bold text-[#0B2545]">{title}</h3>
        </div>
        
        <p className="mb-6 text-sm text-slate-600">{message}</p>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0B2545] hover:bg-[#1C3B62]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
=======
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Yes, continue', cancelText = 'No, cancel', isDanger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0B2545]/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-[#0B2545]'}`}>
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-bold text-[#0B2545]">{title}</h3>
        </div>
        
        <p className="mb-6 text-sm text-slate-600">{message}</p>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0B2545] hover:bg-[#1C3B62]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
>>>>>>> 2ff6cf4 (ai search)
}