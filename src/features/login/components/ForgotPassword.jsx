
import React, { useState } from 'react';
import {
  ArrowLeft,
  MailCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  // FRONTEND ONLY
  // Backend developer will connect email sending here.
  const handleResetPassword = (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setIsLoading(true);

    // UI demonstration only.
    // No email is actually sent.
    setIsLoading(false);
    setIsSent(true);
  };

  const inputClass =
    'h-[45px] w-full rounded-lg bg-[#E7EDF6] px-[15px] text-[13px] text-[#102747] placeholder:text-[#96A7BD] outline-none focus:ring-2 focus:ring-[#B58B34]/40';

  const resetForm = () => {
    setEmail('');
    setError('');
    setIsSent(false);
    setIsLoading(false);
    onBack();
  };

  return (
    <div className="w-full">

      {!isSent ? (
        <>

          {/* FORGOT PASSWORD FORM */}
          <form
            onSubmit={handleResetPassword}
            className="space-y-[20px]"
          >
            {/* EMAIL */}
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-[6px] block text-[13px] font-medium text-[#102747]"
              >
                Email
              </label>

              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                placeholder="Enter your registered email"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <p
                role="alert"
                className="text-center text-[12px] text-red-500"
              >
                {error}
              </p>
            )}

            {/* SEND RESET LINK BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                flex h-[50px] w-full
                items-center justify-center gap-2
                rounded-[10px]
                bg-[#102747]
                text-[14px] font-bold text-white
                transition
                hover:bg-[#1B3A5E]
                active:scale-[0.99]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {isLoading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          {/* BACK TO LOGIN */}
          <div className="mt-[23px] text-center">
            <button
              type="button"
              onClick={resetForm}
              className="
                inline-flex items-center
                justify-center gap-2
                text-[12px] font-medium
                text-[#102747]
                transition hover:underline
              "
            >
              <ArrowLeft size={15} />
              Back to Log in
            </button>
          </div>
        </>
      ) : (
        <>
          {/* SUCCESS SCREEN */}
          <div className="flex flex-col items-center text-center">

            {/* SUCCESS ICON */}
            <div className="mb-[20px] flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#E7EDF6]">
              <MailCheck
                size={35}
                strokeWidth={1.6}
                className="text-[#102747]"
              />
            </div>

            {/* TITLE */}
            <h3 className="mb-[12px] text-[19px] font-bold text-[#102747]">
              Check Your Email
            </h3>

            {/* DESCRIPTION */}
            <p className="mb-[12px] text-[13px] leading-[21px] text-[#61738A]">
              If an account exists with this email,
              a password reset link will be sent to:
            </p>

            {/* EMAIL ADDRESS */}
            <div className="mb-[20px] w-full rounded-[10px] bg-[#E7EDF6] px-[15px] py-[13px]">
              <p className="break-all text-[13px] font-semibold text-[#102747]">
                {email}
              </p>
            </div>

            {/* REMINDER */}
            <p className="mb-[25px] text-[12px] leading-[19px] text-[#61738A]">
              Please check your inbox and spam folder.
            </p>

            {/* BACK TO LOGIN BUTTON */}
            <button
              type="button"
              onClick={resetForm}
              className="
                h-[50px] w-full
                rounded-[10px]
                bg-[#102747]
                text-[14px] font-bold text-white
                transition
                hover:bg-[#1B3A5E]
                active:scale-[0.99]
              "
            >
              Back to Log in
            </button>
          </div>
        </>
      )}
    </div>
  );
}