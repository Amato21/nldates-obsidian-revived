import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import type { Moment } from "moment";
import getChronos from "./chrono";

import { DayOfWeek } from "./settings";
import {
  getLastDayOfMonth,
  getLocaleWeekStart,
  getWeekNumber,
} from "./utils";

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: Moment;
}

export default class NLDParser {
  chronos: Chrono[];
  
  // REGEX : Détecte "in X minutes/hours" ou "dans X minutes/heures"
  // C'est ça qui va sauver la mise en anglais.
  regexRelative = /^\s*(?:in|dans)\s+(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours|heures?)\s*$/i;

  constructor(languages: string[]) {
    this.chronos = getChronos(languages);
  }

  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();

    let bestResult: any = null;
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text, referenceDate, option);
        if (results && results.length > 0) {
          const match = results[0];
          if (match.text.length > bestScore) {
            bestScore = match.text.length;
            bestResult = match;
          }
        }
      } catch (e) {
        console.warn("NLDates: parsing error", e);
      }
    }

    return bestResult ? bestResult.start.date() : new Date();
  }

  getParsedResult(text: string): ParsedResult[] {
    if (!this.chronos) return [];

    let bestResults: ParsedResult[] = [];
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text);
        if (results && results.length > 0) {
          if (results[0].text.length > bestScore) {
            bestScore = results[0].text.length;
            bestResults = results;
          }
        }
      } catch (e) {
        console.warn("NLDates: parsing error", e);
      }
    }
    return bestResults;
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    // --- 1. LE BYPASS MANUEL (La solution 100% fiable) ---
    // Si on détecte "in 2 minutes", on fait le calcul nous-même.
    // On n'attend pas que le moteur anglais se réveille.
    const manualMatch = selectedText.match(this.regexRelative);
    if (manualMatch) {
        const value = parseInt(manualMatch[1]);
        const unitStr = manualMatch[2].toLowerCase();
        
        // On détermine si c'est des minutes ou des heures
        let unit: 'minutes' | 'hours' = 'minutes';
        if (unitStr.startsWith('h')) unit = 'hours';

        // On utilise moment() pour ajouter le temps proprement
        return window.moment().add(value, unit).toDate();
    }

    // --- 2. Si ce n'est pas "in X min", on utilise le moteur classique ---
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    const initialParse = this.getParsedResult(selectedText);
    if (!initialParse || initialParse.length === 0) {
        return new Date();
    }

    const weekdayIsCertain = initialParse[0]?.start?.isCertain("weekday");
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = weekdayIsCertain ? window.moment().weekday(0).toDate() : new Date();

    // Gestion des cas spécifiques "this week", "next month", etc.
    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(/(last day of|end of)\s*([^\n\r]*)/i);
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return this.getParsedDateResult(`this ${weekStart}`, referenceDate);
    }
    if (nextDateMatch && nextDateMatch[1] === "week") {
      return this.getParsedDateResult(`next ${weekStart}`, referenceDate, { forwardDate: true });
    }
    if (nextDateMatch && nextDateMatch[1] === "month") {
      const thisMonth = this.getParsedDateResult("this month", new Date(), { forwardDate: true });
      return this.getParsedDateResult(selectedText, thisMonth, { forwardDate: true });
    }
    if (nextDateMatch && nextDateMatch[1] === "year") {
      const thisYear = this.getParsedDateResult("this year", new Date(), { forwardDate: true });
      return this.getParsedDateResult(selectedText, thisYear, { forwardDate: true });
    }
    if (lastDayOfMatch) {
      const tempDate = this.getParsedResult(lastDayOfMatch[2]);
      if (tempDate && tempDate[0]) {
          const year = tempDate[0].start.get("year");
          const month = tempDate[0].start.get("month");
          const lastDay = getLastDayOfMonth(year, month);
          return this.getParsedDateResult(`${year}-${month}-${lastDay}`, new Date(), { forwardDate: true });
      }
    }
    if (midOf) {
      return this.getParsedDateResult(`${midOf[1]} 15th`, new Date(), { forwardDate: true });
    }

    return this.getParsedDateResult(selectedText, referenceDate, { locale, forwardDate: true } as any);
  }

  // --- 3. FIX DE L'AFFICHAGE DE L'HEURE ---
  hasTimeComponent(text: string): boolean {
    // Si c'est notre bypass "in X minutes", ALORS OUI il y a une heure !
    if (this.regexRelative.test(text)) {
        return true;
    }

    if (!this.chronos) return false;

    // Sinon on demande aux moteurs
    for (const c of this.chronos) {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
          // Si une Heure ou une Minute est détectée
          if (start && (start.isCertain("hour") || start.isCertain("minute"))) {
            return true;
          }
        }
      } catch (e) {
        console.warn("Check time error", e);
      }
    }
    return false;
  }
}