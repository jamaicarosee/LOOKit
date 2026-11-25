import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getPasswordChecks } from '../utils/signupValidation';

const RULES = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasUppercase', label: '1 uppercase letter (A-Z)' },
  { key: 'hasNumber', label: '1 number (0-9)' },
  { key: 'hasSpecialChar', label: '1 special character (!@#$)' },
];

export default function PasswordStrengthChecklist({ password }) {
  const checks = getPasswordChecks(password);

  return (
    <ul
      aria-label="Password requirements"
      className="mt-2 grid grid-cols-1 gap-1.5 rounded-lg bg-[#F4F7FB] px-3 py-2.5 sm:grid-cols-2"
    >
      {RULES.map(({ key, label }) => {
        const passed = checks[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              passed ? 'text-emerald-700' : 'text-[#61738A]'
            }`}
          >
            {passed ? (
              <Check size={13} strokeWidth={2.5} className="shrink-0 text-emerald-600" />
            ) : (
              <Circle size={11} className="shrink-0 text-[#96A7BD]" />
            )}
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}