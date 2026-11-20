<<<<<<< HEAD
import React, { useEffect, useState } from 'react';
=======
import React, { useState } from 'react';
>>>>>>> 1e25e3c (Added PWD validation and Staff Directory Location)
import { User } from 'lucide-react';

import { useAuth } from '../../login/context/AuthContext';

export default function MobileTopBar({ onProfileClick }) {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Get Google / LOOKit account information
  const { user, profile, isAuthenticated } = useAuth();

  const metadata = user?.user_metadata || {};

  const displayName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    'LOOKit User';

  const profilePicture = isAuthenticated
    ? (
        profile?.avatar_url ||
        metadata.avatar_url ||
        metadata.picture ||
        ''
      )
    : '';

  // Reset avatar error when the profile picture changes
  useEffect(() => {
    setAvatarError(false);
  }, [profilePicture]);

  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-2 bg-white shrink-0">
      {/* LOOKIT LOGO */}
      <div className="relative h-8 w-28 overflow-hidden flex items-center justify-center select-none">
        {!imgError ? (
          <img
            src="/lookit_logo_mobile.png"
            alt="LOOKiT Logo"
            onError={() => setImgError(true)}
            className="w-36 h-36 max-w-none object-contain pointer-events-none"
          />
        ) : (
          /* SVG Fallback with Eyes Gazing Distinctly Left */
          <div className="flex items-center font-black text-xl tracking-tight text-[#0B2545]">
            <span>L</span>

            <svg viewBox="0 0 28 28" className="w-5 h-5 mx-0.5">
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke="#0B2545"
                strokeWidth="3"
              />
              <circle
                cx="8.5"
                cy="13.5"
                r="5.5"
                fill="#0B2545"
              />
              <circle
                cx="10.5"
                cy="11.5"
                r="1.6"
                fill="#FFFFFF"
              />
            </svg>

            <svg viewBox="0 0 28 28" className="w-5 h-5 mr-0.5">
              <circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke="#0B2545"
                strokeWidth="3"
              />
              <circle
                cx="8.5"
                cy="13.5"
                r="5.5"
                fill="#0B2545"
              />
              <circle
                cx="10.5"
                cy="11.5"
                r="1.6"
                fill="#FFFFFF"
              />
            </svg>

            <span>K</span>

            <div className="relative flex items-center justify-center mx-0.5 -mt-0.5">
              <svg
                viewBox="0 0 24 28"
                className="w-5 h-6 text-[#0B2545] fill-none stroke-current"
                strokeWidth="2.5"
              >
                <path d="M12 2C7.03 2 3 6.03 3 11c0 6.5 9 15 9 15s9-8.5 9-15c0-4.97-4.03-9-9-9z" />
                <circle
                  cx="12"
                  cy="11"
                  r="3.5"
                  fill="#0B2545"
                />
                <line
                  x1="12"
                  y1="9"
                  x2="12"
                  y2="13"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
                <line
                  x1="10"
                  y1="11"
                  x2="14"
                  y2="11"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
              </svg>
            </div>

            <span>T</span>
          </div>
        )}
      </div>

      {/* GOOGLE / LOOKIT PROFILE BUTTON */}
      <button
        type="button"
        onClick={onProfileClick}
        aria-label={
          isAuthenticated
            ? `Open ${displayName}'s profile`
            : 'User Profile'
        }
        className="
          w-9 h-9
          shrink-0
          rounded-full
          bg-[#0B2545]
          text-white
          flex items-center justify-center
          overflow-hidden
          shadow-sm
          active:scale-95
          transition-transform
        "
      >
        {profilePicture && !avatarError ? (
          <img
            src={profilePicture}
            alt={`${displayName}'s profile`}
            referrerPolicy="no-referrer"
            className="w-full h-full rounded-full object-cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <User className="w-4 h-4 stroke-[2.2]" />
        )}
      </button>
    </header>
  );
}