import { registerSW } from 'virtual:pwa-register';

let updateSWFn = null;

export function initServiceWorker({ onNeedRefresh, onOfflineReady } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (typeof onNeedRefresh === 'function') {
        onNeedRefresh();
      }
    },
    onOfflineReady() {
      if (typeof onOfflineReady === 'function') {
        onOfflineReady();
      }
    },
    onRegisterError(error) {
      console.warn('[LOOKit SW] Registration error:', error);
    },
  });
}

export function applyServiceWorkerUpdate() {
  if (typeof updateSWFn === 'function') {
    updateSWFn(true);
  } else {
    window.location.reload();
  }
}