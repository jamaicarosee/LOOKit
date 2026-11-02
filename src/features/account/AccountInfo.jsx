
import React, { useState } from 'react';
import {
  ArrowLeft,
  UserRound,
  Search,
  X,
} from 'lucide-react';

export default function AccountInfo({
  onBackToMap,
  onLogout,
  user,
}) {
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
            aria-label="Back to map"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white shadow-md"
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
              {user?.name || 'LOOKit User'}
            </p>
            <p className="truncate text-[10px] text-[#102747]">
              {user?.email || 'No email available'}
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
              className="text-[11px] text-[#B58B34] hover:underline"
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
                      aria-label={`Remove ${searchText}`}
                      className="text-[#102747] hover:text-red-500"
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
          onClick={onLogout}
          className="h-[45px] w-full rounded-[11px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E]"
        >
          Log out
        </button>
      </div>
    </div>
  );
}