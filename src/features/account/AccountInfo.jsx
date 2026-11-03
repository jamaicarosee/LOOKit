import React, { useState } from 'react';
import {
  ArrowLeft,
  UserRound,
  Search,
  X,
  Loader2,
} from 'lucide-react';

export default function AccountInfo({
  onBackToMap,
  onLogout,
  user,
  profile,
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('lookit_recent_searches') || '[]'
      );
    } catch {
      return [];
    }
  });

  const removeSearch = (index) => {
    const updated = recentSearches.filter((_, i) => i !== index);
    setRecentSearches(updated);
    localStorage.setItem(
      'lookit_recent_searches',
      JSON.stringify(updated)
    );
  };

  const clearSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('lookit_recent_searches');
  };

  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName =
    profile?.full_name ||
    user?.full_name ||
    user?.user_metadata?.full_name ||
    user?.name ||
    'LOOKit User';

  const displayEmail =
    profile?.email ||
    user?.email ||
    'No email available';

  return (
    <div className="flex h-full w-full justify-center overflow-y-auto bg-[#F8F9F9]">
      <div className="min-h-full w-full max-w-[480px] bg-white px-[22px] pb-10 pt-[25px] lg:mt-8 lg:min-h-0 lg:rounded-[24px] lg:px-[30px] lg:shadow-sm">

        {/* HEADER */}
        <div className="mb-[45px] flex items-center justify-between">
          <h1 className="text-[26px] font-black tracking-[-1px] text-[#071A5B]">
            LOOK!T
          </h1>

          <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#102747]">
            <UserRound size={20} strokeWidth={1.5} className="text-white" />
          </div>
        </div>

        {/* PAGE TITLE */}
        <div className="mb-[35px] flex items-center gap-[14px]">
          <button
            type="button"
            onClick={onBackToMap}
            disabled={isLoggingOut}
            aria-label="Back to map"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white shadow-md disabled:opacity-60"
          >
            <ArrowLeft size={19} className="text-[#102747]" />
          </button>

          <h2 className="text-[17px] font-extrabold text-[#102747]">
            ACCOUNT INFORMATION
          </h2>
        </div>

        {/* ACCOUNT DETAILS */}
        <div className="mb-[35px] flex items-center gap-[15px] rounded-[10px] bg-[#E7EDF6] px-[13px] py-[12px]">
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#102747]">
            <UserRound size={25} strokeWidth={1.3} className="text-white" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#102747]">
              {displayName}
            </p>
            <p className="truncate text-[10px] text-[#102747]">
              {displayEmail}
            </p>
          </div>
        </div>

        {/* RECENT SEARCHES */}
        <div className="mb-[35px]">
          <div className="mb-[9px] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[#102747]">
              Recent searches
            </h3>

            <button
              type="button"
              onClick={clearSearches}
              disabled={isLoggingOut}
              className="text-[11px] text-[#B58B34] hover:underline disabled:opacity-60"
            >
              Clear all
            </button>
          </div>

          <div className="overflow-hidden rounded-[9px] border border-[#D4DDE9] bg-[#F8FAFC]">
            {recentSearches.length === 0 ? (
              <p className="px-3 py-5 text-center text-[12px] text-[#96A7BD]">
                No recent searches yet.
              </p>
            ) : (
              recentSearches.map((item, index) => {
                const searchText =
                  typeof item === 'string'
                    ? item
                    : item?.name || item?.label || item?.query || '';

                return (
                  <div
                    key={`${searchText}-${index}`}
                    className="flex min-h-[38px] items-center gap-[12px] border-b border-[#D4DDE9] px-[12px] last:border-b-0"
                  >
                    <Search size={13} className="text-[#102747]" />

                    <span className="flex-1 truncate text-[12px] text-[#102747]">
                      {searchText}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeSearch(index)}
                      disabled={isLoggingOut}
                      aria-label={`Remove ${searchText}`}
                      className="text-[#102747] hover:text-red-500 disabled:opacity-60"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogoutClick}
          disabled={isLoggingOut}
          className="flex h-[45px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? (
            <>
              <Loader2 size={18} className="animate-spin text-white" />
              <span>Logging out...</span>
            </>
          ) : (
            'Log out'
          )}
        </button>
      </div>
    </div>
  );
}