
import React, { useState } from "react";
import { KeyRound, X, ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPassword({ onClose, onBackToLogin }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleReset = (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // FRONTEND DEMO ONLY
    // Supabase password update will be connected later.
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102747]/60 px-3 py-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="w-full max-w-[600px] max-h-[95dvh] overflow-y-auto rounded-[30px] bg-white px-6 py-8 shadow-xl sm:px-11 sm:py-10"
      >
        {!success ? (
          <>
            {/* HEADER */}
            <div className="mb-9 flex items-start gap-4">
              <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[17px] bg-[#102747]">
                <KeyRound size={27} color="white" />
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <h2
                  id="reset-password-title"
                  className="text-[21px] font-bold text-[#102747]"
                >
                  Reset Password
                </h2>
                <p className="mt-1 text-[14px] text-[#61738A]">
                  Create a new password for your LOOKit account
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="mt-3 text-[#61738A] hover:text-[#102747]"
              >
                <X size={23} />
              </button>
            </div>

            {/* FORM */}
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
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-[57px] w-full rounded-[11px] bg-[#E7EDF6] px-5 pr-12 text-[14px] text-[#102747] outline-none placeholder:text-[#91A6C2] focus:ring-2 focus:ring-[#102747]/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-[57px] w-full rounded-[11px] bg-[#E7EDF6] px-5 pr-12 text-[14px] text-[#102747] outline-none placeholder:text-[#91A6C2] focus:ring-2 focus:ring-[#102747]/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#61738A]"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-center text-[12px] text-red-500">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="h-[61px] w-full rounded-[11px] bg-[#102747] text-[15px] font-bold text-white transition hover:bg-[#1C3B62]"
              >
                Reset Password
              </button>
            </form>

            <button
              type="button"
              onClick={onBackToLogin}
              className="mx-auto mt-8 flex items-center gap-3 text-[14px] font-medium text-[#102747]"
            >
              <ArrowLeft size={18} />
              Back to Log in
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center py-5 text-center">
            <CheckCircle2 size={60} className="mb-5 text-[#102747]" />

            <h2
              id="reset-password-title"
              className="text-[22px] font-bold text-[#102747]"
            >
              Password Reset Preview
            </h2>

            <p className="mb-7 mt-3 text-[14px] leading-6 text-[#61738A]">
              Your new password passed the form validation.
              Actual password updating will be available once
              Supabase authentication is connected.
            </p>

            <button
              type="button"
              onClick={onBackToLogin}
              className="h-[55px] w-full rounded-[11px] bg-[#102747] text-[14px] font-bold text-white hover:bg-[#1C3B62]"
            >
              Back to Log in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}