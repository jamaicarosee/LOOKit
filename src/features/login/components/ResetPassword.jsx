import React, { useState } from 'react';
import { KeyRound, X, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword({ onClose, onBackToLogin, isForced = false }) {
  const { completePasswordChange } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password.length > 72) {
      setError('Password must be at most 72 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // Call backend route that updates the password and clears must_change_password
      await apiClient.post('/api/auth/change-password', {
        new_password: password,
      });

      completePasswordChange();
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update password.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    if (isForced) {
      onClose();
    } else if (onBackToLogin) {
      onBackToLogin();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102747]/60 px-3 py-4"
      onMouseDown={(e) => {
        // Disallow outside dismissal when password change is required
        if (!isForced && e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="w-full max-w-[600px] max-h-[95dvh] overflow-y-auto rounded-[30px] bg-white px-6 py-8 shadow-xl sm:px-11 sm:py-10"
      >
        {!success ? (
          <>
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[17px] bg-[#102747]">
                <KeyRound size={27} color="white" />
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h2 id="reset-password-title" className="text-[21px] font-bold text-[#102747]">
                  {isForced ? 'Set New Password' : 'Reset Password'}
                </h2>
                <p className="mt-1 text-[14px] text-[#61738A]">
                  {isForced
                    ? 'Please set a secure personal password to continue.'
                    : 'Create a new password for your LOOKit account'}
                </p>
              </div>
              {!isForced && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="mt-3 text-[#61738A] hover:text-[#102747]"
                >
                  <X size={23} />
                </button>
              )}
            </div>

            {/* Validation Notice for Temporary Password */}
            {isForced && (
              <div className="mb-6 flex items-start gap-3 rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-[13px] font-medium leading-relaxed">
                  This account use temporary password and you must change the password right now
                </p>
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-[14px] font-semibold text-[#102747]"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min. 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-[57px] w-full rounded-[11px] bg-[#E7EDF6] px-5 pr-12 text-[14px] text-[#102747] outline-none placeholder:text-[#91A6C2] focus:ring-2 focus:ring-[#102747]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#61738A]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-2 block text-[14px] font-semibold text-[#102747]"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-[57px] w-full rounded-[11px] bg-[#E7EDF6] px-5 pr-12 text-[14px] text-[#102747] outline-none placeholder:text-[#91A6C2] focus:ring-2 focus:ring-[#102747]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#61738A]"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-center text-[12px] font-semibold text-red-500">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="h-[61px] w-full rounded-[11px] bg-[#102747] text-[15px] font-bold text-white transition hover:bg-[#1C3B62] disabled:opacity-60"
              >
                {isLoading ? 'Saving…' : 'Update Password'}
              </button>
            </form>

            {!isForced && (
              <button
                type="button"
                onClick={onBackToLogin}
                className="mx-auto mt-8 flex items-center gap-3 text-[14px] font-medium text-[#102747]"
              >
                <ArrowLeft size={18} /> Back to Log in
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-5 text-center">
            <CheckCircle2 size={60} className="mb-5 text-[#217346]" />
            <h2 className="text-[22px] font-bold text-[#102747]">Password Updated Successfully</h2>
            <p className="mb-7 mt-3 text-[14px] leading-6 text-[#61738A]">
              Your password has been securely changed. You can now access LOOKit.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              className="h-[55px] w-full rounded-[11px] bg-[#102747] text-[14px] font-bold text-white hover:bg-[#1C3B62]"
            >
              Continue to LOOKit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}