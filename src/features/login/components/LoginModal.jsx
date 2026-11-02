
import React, { useEffect, useState } from 'react';
import {
  UserRound,
  X,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import TermsAndConditions from './TermsAndConditions';
import ForgotPassword from './ForgotPassword';

export default function LoginModal({
  onClose,
  loginRequired = false,
}) {
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const switchForm = (newMode) => {
    setMode(newMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isForgot) {
      setMessage(
        'Password recovery is not available yet. Please contact the system administrator.'
      );
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setMessage('Authentication is not connected yet.');
  };

  const inputClass =
    'h-[45px] w-full rounded-lg bg-[#E7EDF6] px-[15px] text-[13px] text-[#102747] placeholder:text-[#96A7BD] outline-none focus:ring-2 focus:ring-[#B58B34]/40';

  const labelClass =
    'mb-[6px] block text-[13px] font-medium text-[#102747]';

  const PasswordInput = ({
    id,
    label,
    value,
    onChange,
    visible,
    onToggle,
    placeholder,
    autoComplete,
  }) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-[45px]`}
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-[15px] flex items-center text-[#96A7BD] hover:text-[#102747]"
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
    </div>
  );

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
                {isForgot ? (
                  <KeyRound
                    size={22}
                    strokeWidth={1.8}
                    className="text-white"
                  />
                ) : (
                  <UserRound
                    size={22}
                    strokeWidth={1.8}
                    className="text-white"
                  />
                )}
              </div>

              <div>
                <h2
                  id="login-title"
                  className="text-[17px] font-bold text-[#102747]"
                >
                  {isLogin
                    ? 'Log in'
                    : isSignup
                    ? 'Create account'
                    : 'Forgot Password'}
                </h2>

                {isForgot && (
                  <p className="mt-1 text-[12px] text-[#61738A]">
                    Recover your LOOKit account
                  </p>
                )}
              </div>
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

          {/* LOGIN / CREATE ACCOUNT */}
          {loginRequired && !isForgot && (
            <div className="mb-[20px] rounded-[10px] bg-[#E7EDF6] px-[15px] py-[13px]">
              <p className="text-center text-[12px] leading-5 text-[#102747]">
                Please log in or create an account to start navigation.
              </p>
            </div>
          )}
          {!isForgot && (
            <form
              key={mode}
              onSubmit={handleSubmit}
              className="space-y-[17px]"
            >
              {/* FULL NAME */}
              {isSignup && (
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
                <div className="mb-[6px] flex items-center justify-between">
                  <label
                    htmlFor="lookit-password"
                    className="text-[13px] font-medium text-[#102747]"
                  >
                    Password
                  </label>

                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => switchForm('forgot')}
                      className="text-[11px] text-[#B58B34] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

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

              {/* CONFIRM PASSWORD */}
              {isSignup && (
                <PasswordInput
                  id="lookit-confirm-password"
                  label="Re-enter password"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirmPassword}
                  onToggle={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                />
              )}

              {/* CHECKBOX */}
              <div className="flex items-center gap-[9px] text-[12px] text-[#61738A]">
                <input
                  id="lookit-agreement"
                  type="checkbox"
                  required={isSignup}
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

              {/* MESSAGE */}
              {message && (
                <p
                  role="status"
                  className="text-center text-[12px] text-[#B58B34]"
                >
                  {message}
                </p>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                className="h-[50px] w-full rounded-[10px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] active:scale-[0.99]"
              >
                {isLogin ? 'Log in' : 'Sign up'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {isForgot && (
            <ForgotPassword
              onBack={() => switchForm('login')}
            />
          )}

          {/* SWITCH LOGIN / SIGNUP */}
          {!isForgot && (
            <div className="mt-[23px] text-center text-[12px] text-[#61738A]">
              {isLogin ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchForm('signup')}
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
                    onClick={() => switchForm('login')}
                    className="font-bold text-[#B58B34] hover:text-[#8F6C20]"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}