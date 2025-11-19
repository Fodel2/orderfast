const memoryFlags = new Set<string>();

function storageKey(restaurantId?: string | null) {
  return restaurantId ? `kiosk_home_seen_${restaurantId}` : null;
}

export function hasSeenHome(restaurantId?: string | null): boolean {
  const key = storageKey(restaurantId);
  if (!key) return false;

  if (memoryFlags.has(key)) return true;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    const value = window.sessionStorage.getItem(key);
    if (value === 'true') {
      memoryFlags.add(key);
      return true;
    }
  }

  return false;
}

export function markHomeSeen(restaurantId?: string | null) {
  const key = storageKey(restaurantId);
  if (!key) return;
  memoryFlags.add(key);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, 'true');
    } catch {
      // ignore storage failures
    }
  }
}

export function clearHomeSeen(restaurantId?: string | null) {
  const key = storageKey(restaurantId);
  if (!key) return;
  memoryFlags.delete(key);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  }
}
