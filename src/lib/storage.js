// Storage wrappers. All keys are namespaced so this app cannot collide with
// other projects hosted on the same origin.
const PREFIX = "discogs-labeler.";
const LEGACY_SETTINGS_KEYS = new Set([
  "fields",
  "fieldOrder",
  "sortKey",
  "sortDir",
  "fontScale",
  "qrScale",
  "pad",
  "templateId",
  "layoutMode",
  "col2Fields",
  "inputMode",
]);

function createStore(getStorage, migrateLegacy = false) {
  return {
    get: (key, fallback) => {
      try {
        const storage = getStorage();
        const raw = storage.getItem(PREFIX + key);
        if (raw !== null) return JSON.parse(raw);
        if (!migrateLegacy || !LEGACY_SETTINGS_KEYS.has(key)) return fallback;

        const legacyRaw = storage.getItem(key);
        if (legacyRaw === null) return fallback;
        const value = JSON.parse(legacyRaw);
        try {
          storage.setItem(PREFIX + key, legacyRaw);
        } catch {
          // A readable legacy value is still useful if migration cannot be saved.
        }
        return value;
      } catch {
        return fallback;
      }
    },
    set: (key, val) => {
      try {
        getStorage().setItem(PREFIX + key, JSON.stringify(val));
      } catch {
        // Quota exceeded or storage disabled — settings are best-effort.
      }
    },
    remove: (key) => {
      try {
        getStorage().removeItem(PREFIX + key);
      } catch {
        // Ignore storage errors.
      }
    },
  };
}

export const LS = createStore(() => localStorage, true);

// The Discogs token is a credential; keep it out of persistent localStorage.
export const SS = createStore(() => sessionStorage);

export function clearAllSettings() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX) || LEGACY_SETTINGS_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors.
  }
  try {
    // Also forget the session-only credential.
    sessionStorage.removeItem(PREFIX + "token");
  } catch {
    // Ignore storage errors.
  }
}
