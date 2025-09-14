import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ru from "./locales/ru.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    fallbackLng: "en",              
    supportedLngs: ["en", "ru"],  
    detection: {
      order: ["localStorage", "navigator"], 
      caches: ["localStorage"],           
      lookupLocalStorage: "i18nextLng",    
    },
    load: "languageOnly",
    interpolation: { escapeValue: false },
    cleanCode: true,
  });

export default i18n;
