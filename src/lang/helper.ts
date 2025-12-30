import i18n from 'roddeh-i18n';

import en from './en';
import ja from './ja';
import fr from './fr';
import pt from './pt';
import de from './de';
import nl from './nl';

const notFoundDefault = "NOTFOUND" as const;

export default function t(key: string, lang: string, variables?: Record<string, string>): string {
  const languages = {
    en: i18n.create({ values: en }),
    ja: i18n.create({ values: ja }),
    fr: i18n.create({ values: fr }),
    pt: i18n.create({ values: pt }),
    de: i18n.create({ values: de }),
    nl: i18n.create({ values: nl }),
  };

  // On force le type ici avec "(languages as any)" pour que TypeScript arrête de bloquer
  const translation = (languages as any)[lang](key, notFoundDefault, variables);
  
  return translation === notFoundDefault ? (languages as any)["en"](key, variables) : translation;
}