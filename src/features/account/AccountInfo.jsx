<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  UserRound,
  Search,
  X,
  Loader2,
  User,
} from 'lucide-react';

import { useViewport } from '../dashboard/hooks/useViewport';
import useRecentSearches from '../search/hooks/useRecentSearches';
import apiClient from '../../services/apiClient';

export default function AccountInfo({
  onBackToMap,
  onLogout,
  user,
  profile,
}) {
  const { isDesktop } = useViewport(1024);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileLogoError, setMobileLogoError] = useState(false);
  const [desktopLogoError, setDesktopLogoError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [recentSearches, setRecentSearches] = useState([]);
  const [loadingSearches, setLoadingSearches] = useState(true);

  // Get name, email, and profile picture from LOOKit / Google
  const metadata = user?.user_metadata || {};

  const displayName =
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    user?.full_name ||
    user?.name ||
    'LOOKit User';

  const displayEmail =
    profile?.email ||
    user?.email ||
    'No email available';

  const profilePicture =
    profile?.avatar_url ||
    metadata.avatar_url ||
    metadata.picture ||
    '';

  // Reset image error when the account picture changes
  useEffect(() => {
    setAvatarError(false);
  }, [profilePicture]);

  // Fetch recent searches from database
  useEffect(() => {
    let isMounted = true;

    setLoadingSearches(true);

    apiClient
      .get('/api/navigation/recent-searches')
      .then((res) => {
        if (isMounted) {
          setRecentSearches(
            res.data?.recent_searches || []
          );
        }
      })
      .catch((err) => {
        console.error(
          'Failed to load recent searches:',
          err
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoadingSearches(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const removeSearch = async (id) => {
    const previousSearches = recentSearches;

    try {
      setRecentSearches((prev) =>
        prev.filter((item) => item.id !== id)
      );

      await apiClient.delete(
        `/api/navigation/recent-searches/${id}`
      );
    } catch (err) {
      console.error(
        'Failed to remove search:',
        err
      );

      setRecentSearches(previousSearches);
    }
  };

  const clearSearches = async () => {
    const previousSearches = recentSearches;

    try {
      setRecentSearches([]);

      await apiClient.delete(
        '/api/navigation/recent-searches/all'
      );
    } catch (err) {
      console.error(
        'Failed to clear searches:',
        err
      );

      setRecentSearches(previousSearches);
    }
  };

  const handleLogoutClick = async () => {
    if (isLoggingOut || !onLogout) return;

    setIsLoggingOut(true);

    try {
      await onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Reusable Google profile picture / default icon
  const ProfileAvatar = ({
    size,
    iconSize,
    light = false,
  }) => (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        light
          ? 'bg-[#E5EEF7] text-[#0B2545]'
          : 'bg-[#102747] text-white'
      }`}
      style={{
        width: size,
        height: size,
      }}
    >
      {profilePicture && !avatarError ? (
        <img
          src={profilePicture}
          alt={`${displayName}'s profile`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setAvatarError(true)}
        />
      ) : (
        <UserRound
          size={iconSize}
          strokeWidth={1.5}
        />
      )}
    </div>
  );

  return (
    <div
      className={`h-[100dvh] w-full overflow-hidden ${
        isDesktop
          ? 'bg-[#F8F9F9]'
          : 'bg-[#0B2545]'
      }`}
    >
      <div
        className={`flex h-full flex-col overflow-hidden bg-white ${
          isDesktop
            ? 'w-full'
            : 'mx-auto w-full max-w-md shadow-2xl'
        }`}
      >

        {/* DESKTOP HEADER */}
        {isDesktop && (
          <header className="z-20 flex h-20 w-full shrink-0 items-center justify-between bg-[#0B2545] px-8">
            <div className="flex h-12 w-40 items-center justify-start overflow-hidden">
              {!desktopLogoError ? (
                <img
                  src="/lookit_logo_desktop.png"
                  alt="LOOKit Logo"
                  onError={() =>
                    setDesktopLogoError(true)
                  }
                  className="pointer-events-none w-40 max-w-none object-cover object-center"
                />
              ) : (
                <span className="text-2xl font-black text-white">
                  LOOKiT
                </span>
              )}
            </div>

            <ProfileAvatar
              size={44}
              iconSize={22}
              light
            />
          </header>
        )}

        {/* MOBILE HEADER */}
        {!isDesktop && (
          <header className="flex shrink-0 items-center justify-between bg-white px-5 pb-2 pt-3">
            <div className="relative flex h-8 w-28 select-none items-center justify-center overflow-hidden">
              {!mobileLogoError ? (
                <img
                  src="/lookit_logo_mobile.png"
                  alt="LOOKit Logo"
                  onError={() =>
                    setMobileLogoError(true)
                  }
                  className="pointer-events-none h-36 w-36 max-w-none object-contain"
                />
              ) : (
                <span className="text-xl font-black tracking-tight text-[#0B2545]">
                  LOOKiT
                </span>
              )}
            </div>

            <ProfileAvatar
              size={36}
              iconSize={18}
            />
          </header>
        )}

        {/* ACCOUNT CONTENT */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div
            className={
              isDesktop
                ? 'mx-auto w-full max-w-[1100px] px-10 pb-12 pt-12'
                : 'w-full px-[22px] pb-10 pt-[25px]'
            }
          >

            {/* BACK BUTTON */}
            <div
              className={`flex items-center gap-[14px] ${
                isDesktop
                  ? 'mb-[45px]'
                  : 'mb-[35px]'
              }`}
            >
              <button
                type="button"
                onClick={onBackToMap}
                disabled={isLoggingOut}
                aria-label="Go back"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white shadow-md transition hover:bg-[#F1F5F9] disabled:opacity-60"
              >
                <ArrowLeft
                  size={19}
                  className="text-[#102747]"
                />
              </button>

              <h2
                className={`font-extrabold text-[#102747] ${
                  isDesktop
                    ? 'text-[21px]'
                    : 'text-[17px]'
                }`}
              >
                ACCOUNT INFORMATION
              </h2>
            </div>

            {/* GOOGLE / LOOKIT PROFILE */}
            <div
              className={`flex items-center rounded-[10px] bg-[#E7EDF6] ${
                isDesktop
                  ? 'mb-[45px] gap-5 px-6 py-5'
                  : 'mb-[35px] gap-[15px] px-[13px] py-[12px]'
              }`}
            >
              <ProfileAvatar
                size={isDesktop ? 60 : 48}
                iconSize={isDesktop ? 30 : 25}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-semibold text-[#102747] ${
                    isDesktop
                      ? 'text-[16px]'
                      : 'text-[13px]'
                  }`}
                >
                  {displayName}
                </p>

                <p
                  className={`truncate text-[#102747] ${
                    isDesktop
                      ? 'text-[13px]'
                      : 'text-[10px]'
                  }`}
                >
                  {displayEmail}
                </p>
              </div>
            </div>

            {/* RECENT SEARCHES */}
            <div className="mb-[35px]">
              <div className="mb-[9px] flex items-center justify-between">
                <h3
                  className={`font-semibold text-[#102747] ${
                    isDesktop
                      ? 'text-[15px]'
                      : 'text-[13px]'
                  }`}
                >
                  Recent searches
                </h3>

                <button
                  type="button"
                  onClick={clearSearches}
                  disabled={
                    isLoggingOut ||
                    loadingSearches ||
                    recentSearches.length === 0
                  }
                  className="text-[11px] text-[#C58A2B] hover:underline disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>

              <div className="overflow-hidden rounded-[9px] border border-[#D4DDE9] bg-[#F8FAFC]">
                {loadingSearches ? (
                  <p className="px-3 py-5 text-center text-[12px] text-[#96A7BD]">
                    Loading searches...
                  </p>
                ) : recentSearches.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[12px] text-[#96A7BD]">
                    No recent searches yet.
                  </p>
                ) : (
                  recentSearches.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 border-b border-[#D4DDE9] last:border-b-0 ${
                        isDesktop
                          ? 'min-h-[50px] px-[18px]'
                          : 'min-h-[42px] px-3'
                      }`}
                    >
                      <Search
                        size={14}
                        className="shrink-0 text-[#102747]"
                      />

                      <span
                        className={`min-w-0 flex-1 truncate text-[#102747] ${
                          isDesktop
                            ? 'text-[14px]'
                            : 'text-[12px]'
                        }`}
                      >
                        {item.location_name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeSearch(item.id)
                        }
                        disabled={isLoggingOut}
                        aria-label={`Remove ${item.location_name}`}
                        className="text-[#102747] transition hover:text-red-500 disabled:opacity-60"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* LOGOUT */}
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className={`flex w-full items-center justify-center gap-2 rounded-[11px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] disabled:cursor-not-allowed disabled:opacity-60 ${
                isDesktop
                  ? 'h-[50px]'
                  : 'h-[45px]'
              }`}
            >
              {isLoggingOut ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  <span>Logging out...</span>
                </>
              ) : (
                'Log out'
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
=======
import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserRound, Search, X, Loader2, User } from 'lucide-react';
import { useViewport } from '../dashboard/hooks/useViewport';
import { apiClient } from '../../services/apiClient';

export default function AccountInfo({ onBackToMap, onLogout, user, profile }) {
  const { isDesktop } = useViewport(1024);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileLogoError, setMobileLogoError] = useState(false);
  const [desktopLogoError, setDesktopLogoError] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loadingSearches, setLoadingSearches] = useState(true);

  // Fetch recent searches from database
  useEffect(() => {
    let isMounted = true;
    apiClient.get('/api/navigation/recent-searches')
      .then((res) => {
        if (isMounted) {
          setRecentSearches(res.data.recent_searches || []);
          setLoadingSearches(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load recent searches:", err);
        if (isMounted) setLoadingSearches(false);
      });
    return () => { isMounted = false; };
  }, []);

  const removeSearch = async (id) => {
    try {
      setRecentSearches((prev) => prev.filter((s) => s.id !== id)); // Optimistic UI update
      await apiClient.delete(`/api/navigation/recent-searches/${id}`);
    } catch (err) {
      console.error("Failed to remove search:", err);
    }
  };

  const clearSearches = async () => {
    try {
      setRecentSearches([]); // Optimistic UI update
      await apiClient.delete('/api/navigation/recent-searches/all');
    } catch (err) {
      console.error("Failed to clear searches:", err);
    }
  };

  const handleLogoutClick = async () => {
    if (isLoggingOut || !onLogout) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = profile?.full_name || user?.full_name || user?.user_metadata?.full_name || user?.name || 'LOOKit User';
  const displayEmail = profile?.email || user?.email || 'No email available';

  return (
    <div className={`h-[100dvh] w-full overflow-hidden ${isDesktop ? 'bg-[#F8F9F9]' : 'bg-[#0B2545]'}`}>
      <div className={`flex h-full flex-col overflow-hidden bg-white ${isDesktop ? 'w-full' : 'mx-auto w-full max-w-md shadow-2xl'}`}>
        
        {/* ============ HEADERS ============ */}
        {isDesktop && (
          <header className="z-20 flex h-20 w-full shrink-0 items-center justify-between bg-[#0B2545] px-8">
            <div className="flex h-12 w-40 items-center justify-start overflow-hidden">
              {!desktopLogoError ? (
                <img src="/lookit_logo_desktop.png" alt="LOOKit Logo" onError={() => setDesktopLogoError(true)} className="pointer-events-none w-40 max-w-none object-cover object-center" />
              ) : (
                <span className="text-2xl font-black text-white">LOOKiT</span>
              )}
            </div>
            <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-full bg-[#E5EEF7] text-[#0B2545] shadow-sm">
              <User className="h-5 w-5 stroke-[2]" />
            </div>
          </header>
        )}

        {!isDesktop && (
          <header className="flex shrink-0 items-center justify-between bg-white px-5 pb-2 pt-3">
            <div className="relative flex h-8 w-28 select-none items-center justify-center overflow-hidden">
              {!mobileLogoError ? (
                <img src="/lookit_logo_mobile.png" alt="LOOKit Logo" onError={() => setMobileLogoError(true)} className="pointer-events-none h-36 w-36 max-w-none object-contain" />
              ) : (
                <span className="text-xl font-black tracking-tight text-[#0B2545]">LOOKiT</span>
              )}
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B2545] text-white shadow-sm">
              <User className="h-4 w-4 stroke-[2.2]" />
            </div>
          </header>
        )}

        {/* ============ ACCOUNT CONTENT ============ */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className={isDesktop ? 'mx-auto w-full max-w-[1100px] px-10 pb-12 pt-12' : 'w-full px-[22px] pb-10 pt-[25px]'}>
            
            <div className={`flex items-center gap-[14px] ${isDesktop ? 'mb-[45px]' : 'mb-[35px]'}`}>
              <button type="button" onClick={onBackToMap} disabled={isLoggingOut} aria-label="Back to map" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white shadow-md transition hover:bg-[#F1F5F9] disabled:opacity-60">
                <ArrowLeft size={19} className="text-[#102747]" />
              </button>
              <h2 className={`font-extrabold text-[#102747] ${isDesktop ? 'text-[21px]' : 'text-[17px]'}`}>
                ACCOUNT INFORMATION
              </h2>
            </div>

            <div className={`flex items-center rounded-[10px] bg-[#E7EDF6] ${isDesktop ? 'mb-[45px] gap-5 px-6 py-5' : 'mb-[35px] gap-[15px] px-[13px] py-[12px]'}`}>
              <div className={`flex shrink-0 items-center justify-center rounded-full bg-[#102747] ${isDesktop ? 'h-[60px] w-[60px]' : 'h-[48px] w-[48px]'}`}>
                <UserRound size={isDesktop ? 30 : 25} strokeWidth={1.3} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className={`truncate font-semibold text-[#102747] ${isDesktop ? 'text-[16px]' : 'text-[13px]'}`}>{displayName}</p>
                <p className={`truncate text-[#102747] ${isDesktop ? 'text-[13px]' : 'text-[10px]'}`}>{displayEmail}</p>
              </div>
            </div>

            {/* RECENT SEARCHES */}
            <div className="mb-[35px]">
              <div className="mb-[9px] flex items-center justify-between">
                <h3 className={`font-semibold text-[#102747] ${isDesktop ? 'text-[15px]' : 'text-[13px]'}`}>
                  Recent searches
                </h3>
                <button type="button" onClick={clearSearches} disabled={isLoggingOut || recentSearches.length === 0} className="text-[11px] text-[#C58A2B] hover:underline disabled:opacity-100">
                  Clear all
                </button>
              </div>

              <div className="overflow-hidden rounded-[9px] border border-[#D4DDE9] bg-[#F8FAFC]">
                {loadingSearches ? (
                  <p className="px-3 py-5 text-center text-[12px] text-[#96A7BD]">Loading searches...</p>
                ) : recentSearches.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[12px] text-[#96A7BD]">No recent searches yet.</p>
                ) : (
                  recentSearches.map((item) => (
                    <div key={item.id} className={`flex items-center gap-3 border-b border-[#D4DDE9] last:border-b-0 ${isDesktop ? 'min-h-[50px] px-[18px]' : 'min-h-[42px] px-3'}`}>
                      <Search size={14} className="shrink-0 text-[#102747]" />
                      <span className={`min-w-0 flex-1 truncate text-[#102747] ${isDesktop ? 'text-[14px]' : 'text-[12px]'}`}>
                        {item.location_name}
                      </span>
                      <button type="button" onClick={() => removeSearch(item.id)} disabled={isLoggingOut} aria-label={`Remove ${item.location_name}`} className="text-[#102747] transition hover:text-red-500 disabled:opacity-60">
                        <X size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button type="button" onClick={handleLogoutClick} disabled={isLoggingOut} className={`flex w-full items-center justify-center gap-2 rounded-[11px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] disabled:cursor-not-allowed disabled:opacity-60 ${isDesktop ? 'h-[50px]' : 'h-[45px]'}`}>
              {isLoggingOut ? (
                <><Loader2 size={18} className="animate-spin" /><span>Logging out...</span></>
              ) : ('Log out')}
            </button>

          </div>
        </main>
      </div>
    </div>
  );
>>>>>>> 2ff6cf4 (ai search)
}