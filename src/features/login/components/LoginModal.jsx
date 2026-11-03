import React, { useEffect, useState } from 'react';
import {
  UserRound,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from 'lucide-react';
import TermsAndConditions from './TermsAndConditions';
import ForgotPassword from './ForgotPassword';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({
  onClose,
  loginRequired = false,
}) {
  const { login, register } = useAuth();

  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, isSubmitting]);

  const switchForm = (newMode) => {
    setMode(newMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPassword('');
    setConfirmPassword('');
    setMessage('');
    setIsError(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);

    if (isForgot) {
      setIsError(true);
      setMessage(
        'Password recovery is not available yet. Please contact the system administrator.'
      );
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setIsError(true);
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        await login({
          email,
          password,
          keepSignedIn,
        });
        onClose();
      } else if (isSignup) {
        const result = await register({
          fullName,
          email,
          password,
        });

        if (result.requiresEmailConfirmation) {
          setIsError(false);
          setMessage(
            'Account created! Please check your email inbox to confirm your account before logging in.'
          );
          setPassword('');
          setConfirmPassword('');
        } else {
          onClose();
        }
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'h-[45px] w-full rounded-lg bg-[#E7EDF6] px-[15px] text-[13px] text-[#102747] placeholder:text-[#96A7BD] outline-none focus:ring-2 focus:ring-[#B58B34]/40 disabled:opacity-60';

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
          disabled={isSubmitting}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-[45px]`}
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={isSubmitting}
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
        if (event.target === event.currentTarget && !isSubmitting) onClose();
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
              disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
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
                  disabled={isSubmitting}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                      disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pr-[45px]`}
                  />

                  <button
                    type="button"
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  checked={isLogin ? keepSignedIn : agreedToTerms}
                  onChange={(event) => {
                    if (isLogin) {
                      setKeepSignedIn(event.target.checked);
                    } else {
                      setAgreedToTerms(event.target.checked);
                    }
                  }}
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
                  className={`text-center text-[12px] ${
                    isError ? 'text-red-600' : 'text-[#B58B34]'
                  }`}
                >
                  {message}
                </p>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>
                      {isLogin ? 'Logging in...' : 'Creating account...'}
                    </span>
                  </>
                ) : isLogin ? (
                  'Log in'
                ) : (
                  'Sign up'
                )}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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