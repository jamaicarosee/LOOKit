import useMinLoading from './useMinLoading';

// How long the nav placeholders stay up after a screen mounts, even when auth is already known.
export const NAV_SKELETON_MIN_MS = 600;

// True while the nav (Map, Staff, About, Admin) should render skeleton placeholders:
// auth is still resolving, or the minimum display time has not passed yet.
export default function useNavLoading(authLoading) {
  return useMinLoading(authLoading, NAV_SKELETON_MIN_MS);
}
