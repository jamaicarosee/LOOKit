
import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';

const terms = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account and using LOOKit, users agree to these Terms and Conditions.',
  },
  {
    title: '2. Purpose of LOOKit',
    body: 'LOOKit is designed to help students, faculty, staff, and visitors navigate Rizal Technological University – Pasig Branch.',
  },
  {
    title: '3. Account Responsibility',
    body: 'Users must provide accurate registration information and keep their account credentials secure.',
  },
  {
    title: '4. Proper Use',
    body: 'Users must use LOOKit responsibly and must not misuse information, attempt unauthorized access, or disrupt the system.',
  },
  {
    title: '5. Data Privacy',
    body: 'Registration information is intended for account management and system-related purposes, subject to applicable Philippine data protection laws.',
  },
  {
    title: '6. Information Accuracy',
    body: 'Campus locations, personnel assignments, and navigation routes may change. Users should follow official campus instructions.',
  },
  {
    title: '7. System Availability',
    body: 'LOOKit may experience temporary interruptions due to maintenance or technical issues.',
  },
  {
    title: '8. Updates and Agreement',
    body: 'Terms may be updated as the system develops. Checking the agreement box indicates acceptance of these terms.',
  },
];

export default function TermsAndConditions() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape, true);

    return () => {
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [open]);

  return (
    <>
      {/* Click only, no underline */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer font-semibold text-[#B58B34] hover:text-[#8F6C20]"
      >
        Terms and Conditions
      </button>

      {open && (
        <div
          className="
            fixed inset-0 z-[100]
            flex items-center justify-center
            bg-[#071C35]/60
            p-4
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-heading"
            className="
              flex w-full max-w-[480px] flex-col
              overflow-hidden rounded-[20px]
              bg-white shadow-2xl
              max-h-[85dvh]
              lg:max-w-[550px]
            "
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between bg-[#102747] px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-[43px] w-[43px] items-center justify-center rounded-[11px] bg-white/15">
                  <FileText size={22} className="text-white" />
                </div>

                <div>
                  <h3
                    id="terms-heading"
                    className="text-[15px] font-bold text-white"
                  >
                    Terms and Conditions
                  </h3>

                  <p className="text-[11px] text-[#CAD5E5]">
                    LOOKit | RTU Pasig Branch
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close terms"
                className="rounded-full p-1 text-white hover:bg-white/10"
              >
                <X size={21} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-[#F8FAFD] px-6 py-6">
              {terms.map((term) => (
                <div key={term.title}>
                  <h4 className="mb-2 text-[13px] font-bold text-[#102747]">
                    {term.title}
                  </h4>

                  <p className="text-[12px] leading-[1.8] text-[#61738A]">
                    {term.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#E5EBF3] bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="
                  h-[46px] w-full
                  rounded-[10px]
                  bg-[#102747]
                  text-[13px] font-semibold text-white
                  transition hover:bg-[#1B3A5E]
                "
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
