export type AppLanguage = "en" | "fr" | "cr";

export const APP_LANGUAGE_STORAGE_KEY = "soleyvolt-language";
export const APP_LANGUAGE_EVENT = "soleyvolt-language-change";

export function getStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const saved = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return saved === "fr" || saved === "cr" ? saved : "en";
}

export function setStoredLanguage(language: AppLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new Event(APP_LANGUAGE_EVENT));
}
