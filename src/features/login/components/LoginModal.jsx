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
import PasswordStrengthChecklist from './PasswordStrengthChecklist';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/authService';
import {
  INVALID_EMAIL_MESSAGE,
  isValidEmailFormat,
  getPasswordError,
} from '../utils/signupValidation';

const inputClass =
  'h-[45px] w-full rounded-lg bg-[#E7EDF6] px-[15px] text-[13px] text-[#102747] placeholder:text-[#96A7BD] outline-none focus:ring-2 focus:ring-[#B58B34]/40 disabled:opacity-60';

const labelClass =
  'mb-[6px] block text-[13px] font-medium text-[#102747]';

// Password input
function PasswordInput({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  autoComplete,
  isBusy,
}) {
  return (
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
          disabled={isBusy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-[45px]`}
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={isBusy}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-[15px] flex items-center text-[#96A7BD] hover:text-[#102747]"
        >
          {visible ? (
            <EyeOff size={19} />
          ) : (
            <Eye size={19} />
          )}
        </button>
      </div>
    </div>
  );
}

// Google logo
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.88 46.98 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.14.78-4.59l-7.98-6.2A23.86 23.86 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.91 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function LoginModal({
  onClose,
  loginRequired = false,
  initialError = '',
  initialNotice = '',
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
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Scoped loading state: null | 'credentials' | 'google'
  const [submittingAction, setSubmittingAction] = useState(null);
  const [message, setMessage] = useState(initialError || initialNotice || '');
  const [isError, setIsError] = useState(Boolean(initialError));

  const isBusy = submittingAction !== null;
  const isCredentialsLoading = submittingAction === 'credentials';
  const isGoogleLoading = submittingAction === 'google';

  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  useEffect(() => {
    if (initialError) {
      setMessage(initialError);
      setIsError(true);
    } else if (initialNotice) {
      setMode('login');
      setMessage(initialNotice);
      setIsError(false);
    }
  }, [initialError, initialNotice]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, isBusy]);

  const switchForm = (newMode) => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsPasswordFocused(false);
    setMessage('');
    setIsError(false);
  };

  // EMAIL / PASSWORD LOGIN AND SIGNUP
  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage('');
    setIsError(false);

    if (isSignup) {
      if (!fullName.trim()) {
        setIsError(true);
        setMessage('Please enter your full name.');
        return;
      }

      if (!isValidEmailFormat(email)) {
        setIsError(true);
        setMessage(INVALID_EMAIL_MESSAGE);
        return;
      }

      const passwordError = getPasswordError(password);
      if (passwordError) {
        setIsError(true);
        setMessage(passwordError);
        return;
      }

      if (password !== confirmPassword) {
        setIsError(true);
        setMessage('Passwords do not match.');
        return;
      }

      if (!agreedToTerms) {
        setIsError(true);
        setMessage('Please agree to the Terms and Conditions.');
        return;
      }
    }

    setSubmittingAction('credentials');

    try {
      if (isLogin) {
        await login({
          email,
          password,
          keepSignedIn,
        });

        onClose();
      } else {
        await register({
          fullName,
          email,
          password,
        });

        setIsError(false);
        setMessage(
          'Account created! Please check your email inbox or spam to verify your account before logging in.'
        );
        setPassword('');
        setConfirmPassword('');
        setIsPasswordFocused(false);
      }
    } catch (err) {
      setIsError(true);
      setMessage(
        err.message ||
          'Authentication failed. Please try again.'
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  // GOOGLE LOGIN
  const handleGoogleSignIn = async () => {
    setSubmittingAction('google');
    setMessage('');
    setIsError(false);

    try {
      await signInWithGoogle();
    } catch (err) {
      setIsError(true);
      setMessage(
        err.message || 'Google sign-in failed. Please try again.'
      );
      setSubmittingAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#071C35]/50 lg:items-center lg:p-6"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isBusy
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="w-full max-w-md max-h-[95dvh] overflow-y-auto rounded-t-[30px] bg-white shadow-2xl lg:max-w-[480px] lg:max-h-[90dvh] lg:rounded-[24px]"
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
              disabled={isBusy}
              aria-label="Close"
              className="rounded-full p-1 text-[#68768A] transition hover:bg-[#E7EDF6]"
            >
              <X size={21} />
            </button>
          </div>

          {/* LOGIN REQUIRED */}
          {loginRequired && !isForgot && (
            <div className="mb-[20px] rounded-[10px] bg-[#E7EDF6] px-[15px] py-[13px]">
              <p className="text-center text-[12px] leading-5 text-[#102747]">
                Please log in or create an account to start navigation.
              </p>
            </div>
          )}

          {/* LOGIN / SIGNUP FORM */}
          {!isForgot && (
            <form
              key={mode}
              onSubmit={handleSubmit}
              noValidate={isSignup}
              className="space-y-[17px]"
            >
              {isSignup && (
                <div>
                  <label
                    htmlFor="lookit-name"
                    className={labelClass}
                  >
                    Full name
                  </label>

                  <input
                    id="lookit-name"
                    type="text"
                    placeholder="Enter your name"
                    autoComplete="name"
                    required
                    disabled={isBusy}
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              )}

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="lookit-email"
                  className={labelClass}
                >
                  Email
                </label>

                <input
                  id="lookit-email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  disabled={isBusy}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
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
                      disabled={isBusy}
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
                    type={
                      showPassword ? 'text' : 'password'
                    }
                    placeholder="Enter your password"
                    autoComplete={
                      isLogin
                        ? 'current-password'
                        : 'new-password'
                    }
                    required
                    minLength={8}
                    disabled={isBusy}
                    value={password}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    className={`${inputClass} pr-[45px]`}
                  />

                  <button
                    type="button"
                    disabled={isBusy}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
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

                {isSignup && isPasswordFocused && (
                  <PasswordStrengthChecklist password={password} />
                )}
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
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  isBusy={isBusy}
                />
              )}

              {/* KEEP SIGNED IN / TERMS */}
              <div className="flex items-center gap-[9px] text-[12px] text-[#61738A]">
                <input
                  id="lookit-agreement"
                  type="checkbox"
                  required={isSignup}
                  disabled={isBusy}
                  checked={
                    isLogin
                      ? keepSignedIn
                      : agreedToTerms
                  }
                  onChange={(event) => {
                    if (isLogin) {
                      setKeepSignedIn(
                        event.target.checked
                      );
                    } else {
                      setAgreedToTerms(
                        event.target.checked
                      );
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

              {/* AUTH MESSAGE */}
              {message && (
                <p
                  role="status"
                  className={`text-center text-[12px] font-medium ${
                    isError
                      ? 'text-red-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {message}
                </p>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={isBusy}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCredentialsLoading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    {isLogin
                      ? 'Logging in...'
                      : 'Creating account...'}
                  </>
                ) : isLogin ? (
                  'Log in'
                ) : (
                  'Sign up'
                )}
              </button>
            </form>
          )}

          {/* CONTINUE WITH GOOGLE */}
          {!isForgot && (
            <div className="mt-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">
                  OR
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isBusy}
                className="flex h-[45px] w-full items-center justify-center gap-3 rounded-lg border border-[#D2D9E3] bg-[#F7F8FA] text-[14px] font-medium text-[#102747] transition hover:bg-[#E7EDF6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <GoogleIcon />
                )}

                Continue with Google
              </button>
            </div>
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
                    disabled={isBusy}
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
                    disabled={isBusy}
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