// CHANGEMENT ICI : On utilise "import * as chrono" car la version 2.x n'a plus d'export par défaut
import * as chrono from "chrono-node";
import { Chrono, Parser, Refiner } from "chrono-node";
import { ORDINAL_NUMBER_PATTERN, parseOrdinalNumberPattern } from "./utils";

// Local type definition matching chrono-node's Configuration interface
// Configuration is not exported from the main module, so we define it locally
interface ChronoConfiguration {
  parsers: Parser[];
  refiners: Refiner[];
}

function getOrdinalDateParser() {
  return ({
    pattern: () => new RegExp(ORDINAL_NUMBER_PATTERN),
    extract: (_context: unknown, match: RegExpMatchArray) => {
      return {
        day: parseOrdinalNumberPattern(match[0]),
        month: window.moment().month(),
      };
    },
  } as Parser);
}

export default function getChronos(languages: string[]): Chrono[] {
  const locale = window.moment.locale();
  const isGB = locale === 'en-gb';

  const chronos: Chrono[] = [];
  const ordinalDateParser = getOrdinalDateParser();
  languages.forEach(l => {
    try {
      // On accède aux langues dynamiquement via Record
      const langModule = (chrono as Record<string, unknown>)[l] as { createCasualConfiguration?: (isGB: boolean) => unknown } | undefined;
      if (!langModule || !langModule.createCasualConfiguration) {
        console.warn(`Language ${l} is not supported by chrono-node`);
        return;
      }
      const config = langModule.createCasualConfiguration(isGB);
      // Chrono constructor accepts Configuration type - cast needed because createCasualConfiguration returns unknown
      const c = new Chrono(config as ChronoConfiguration);
      c.parsers.push(ordinalDateParser);
      chronos.push(c);
    } catch (error) {
      console.error(`Failed to initialize chrono for language ${l}:`, error);
    }
  });
  
  // Si aucune langue n'a pu être initialisée, utiliser l'anglais par défaut
  if (chronos.length === 0) {
    try {
      const enModule = (chrono as Record<string, unknown>).en as { createCasualConfiguration?: (isGB: boolean) => unknown } | undefined;
      if (enModule && enModule.createCasualConfiguration) {
        const config = enModule.createCasualConfiguration(isGB);
        // Chrono constructor accepts Configuration type - cast needed because createCasualConfiguration returns unknown
        const c = new Chrono(config as ChronoConfiguration);
        c.parsers.push(ordinalDateParser);
        chronos.push(c);
      }
    } catch (error) {
      console.error('Failed to initialize default English chrono:', error);
    }
  }
  
  return chronos;
}