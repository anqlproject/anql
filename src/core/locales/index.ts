import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import fr from './fr.json';

i18next
  .use(initReactI18next)
  .init({
    resources: { en, fr },
    lng: 'en',
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;