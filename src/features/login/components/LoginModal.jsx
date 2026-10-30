import React, { useEffect, useState } from 'react';
import { UserRound, X, Eye, EyeOff } from 'lucide-react';
import TermsAndConditions from './TermsAndConditions';

export default function LoginModal({ onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const switchForm = (loginMode) => {
    setIsLogin(loginMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!isLogin && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setMessage('Authentication is not connected yet.');
  };

  const inputClass =
    'h-[45px] w-full rounded-lg bg-[#E7EDF6] px-[15px] text-[13px] text-[#102747] placeholder:text-[#96A7BD] outline-none focus:ring-2 focus:ring-[#B58B34]/40';

  const labelClass =
    'mb-[6px] block text-[13px] font-medium text-[#102747]';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#071C35]/50 lg:items-center lg:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="
          w-full max-w-md
          max-h-[95dvh]
          overflow-y-auto
          rounded-t-[30px]
          bg-white
          shadow-2xl
          lg:max-w-[480px]
          lg:max-h-[90dvh]
          lg:rounded-[24px]
        "
      >
        <div className="px-[30px] pb-[30px] pt-[25px] sm:px-[35px] lg:px-[35px] lg:py-[30px]">

          {/* HEADER */}
          <div className="mb-[27px] flex items-center justify-between">
            <div className="flex items-center gap-[12px]">
              <div className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-[13px] bg-[#102747]">
                <UserRound
                  size={22}
                  strokeWidth={1.8}
                  className="text-white"
                />
              </div>

              <h2
                id="login-title"
                className="text-[17px] font-bold text-[#102747]"
              >
                {isLogin ? 'Log in' : 'Create account'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-[#68768A] transition hover:bg-[#E7EDF6]"
            >
              <X size={21} />
            </button>
          </div>

          {/* LOGIN / CREATE ACCOUNT FORM */}
          <form
            key={isLogin ? 'login' : 'signup'}
            onSubmit={handleSubmit}
            className="space-y-[17px]"
          >

            {/* FULL NAME - CREATE ACCOUNT ONLY */}
            {!isLogin && (
              <div>
                <label htmlFor="lookit-name" className={labelClass}>
                  Full name
                </label>

                <input
                  id="lookit-name"
                  type="text"
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                  className={inputClass}
                />
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label htmlFor="lookit-email" className={labelClass}>
                Email
              </label>

              <input
                id="lookit-email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label htmlFor="lookit-password" className={labelClass}>
                Password
              </label>

              <div className="relative">
                <input
                  id="lookit-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete={
                    isLogin ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-[45px]`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute inset-y-0 right-[15px] flex items-center text-[#96A7BD] hover:text-[#102747]"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD - CREATE ACCOUNT ONLY */}
            {!isLogin && (
              <div>
                <label
                  htmlFor="lookit-confirm-password"
                  className={labelClass}
                >
                  Re-enter password
                </label>

                <div className="relative">
                  <input
                    id="lookit-confirm-password"
                    type={
                      showConfirmPassword ? 'text' : 'password'
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    className={`${inputClass} pr-[45px]`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label={
                      showConfirmPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    className="absolute inset-y-0 right-[15px] flex items-center text-[#96A7BD] hover:text-[#102747]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* CHECKBOX */}
            <div className="flex items-center gap-[9px] text-[12px] text-[#61738A]">
              <input
                id="lookit-agreement"
                type="checkbox"
                required={!isLogin}
                className="h-[17px] w-[17px] shrink-0 cursor-pointer accent-[#102747]"
              />

              {isLogin ? (
                <label htmlFor="lookit-agreement">
                  Keep me signed in
                </label>
              ) : (
                <span>
                  <label htmlFor="lookit-agreement">
                    I agree to the{' '}
                  </label>
                  <TermsAndConditions />
                </span>
              )}
            </div>

            {/* VALIDATION MESSAGE */}
            {message && (
              <p
                role="status"
                className="text-center text-[12px] text-[#B58B34]"
              >
                {message}
              </p>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="h-[50px] w-full rounded-[10px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] active:scale-[0.99]"
            >
              {isLogin ? 'Log in' : 'Sign up'}
            </button>
          </form>

          {/* SWITCH BETWEEN LOGIN AND CREATE ACCOUNT */}
          <div className="mt-[23px] text-center text-[12px] text-[#61738A]">
            {isLogin ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchForm(false)}
                  className="font-bold text-[#B58B34] hover:text-[#8F6C20]"
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchForm(true)}
                  className="font-bold text-[#B58B34] hover:text-[#8F6C20]"
                >
                  Log in
                </button>
              </>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}