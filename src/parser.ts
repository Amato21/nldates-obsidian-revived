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

  constructor(languages: string[]) {
    this.chronos = getChronos(languages);
  }

  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    let result: Date;
    if (!this.chronos || this.chronos.length === 0) return new Date();

    this.chronos.some(c => {
      try {
        const parsedDate = c.parseDate(text, referenceDate, option);
        if (parsedDate) {
          result = parsedDate;
          return true; 
        }
      } catch (e) {
        console.warn("NLDates: Error parsing date", e);
      }
      return false;
    });
    
    return result;
  }

  getParsedResult(text: string): ParsedResult[] {
    let result: ParsedResult[];
    if (!this.chronos) return [];

    this.chronos.some(c => {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          result = parsedResult;
          return true;
        }
      } catch (e) {
        console.warn("NLDates: Error parsing result", e);
      }
      return false;
    });
    return result;
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    const initialParse = this.getParsedResult(selectedText);
    
    if (!initialParse || initialParse.length === 0) {
        return new Date();
    }

    const weekdayIsCertain = initialParse[0]?.start?.isCertain("weekday");

    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    const locale = {
      weekStart: getWeekNumber(weekStart),
    };

    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(/(last day of|end of)\s*([^\n\r]*)/i);
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    const referenceDate = weekdayIsCertain
      ? window.moment().weekday(0).toDate()
      : new Date();

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return this.getParsedDateResult(`this ${weekStart}`, referenceDate);
    }

    if (nextDateMatch && nextDateMatch[1] === "week") {
      return this.getParsedDateResult(`next ${weekStart}`, referenceDate,{
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1] === "month") {
      const thisMonth = this.getParsedDateResult("this month", new Date(),{
        forwardDate: true,
      });
      return this.getParsedDateResult(selectedText, thisMonth, {
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1] === "year") {
      const thisYear = this.getParsedDateResult("this year", new Date(), {
        forwardDate: true,
      });
      return this.getParsedDateResult(selectedText, thisYear, {
        forwardDate: true,
      });
    }

    if (lastDayOfMatch) {
      const tempDate = this.getParsedResult(lastDayOfMatch[2]);
      if (tempDate && tempDate[0]) {
          const year = tempDate[0].start.get("year");
          const month = tempDate[0].start.get("month");
          const lastDay = getLastDayOfMonth(year, month);
          return this.getParsedDateResult(`${year}-${month}-${lastDay}`, new Date(), {
            forwardDate: true,
          });
      }
    }

    if (midOf) {
      return this.getParsedDateResult(`${midOf[1]} 15th`, new Date(), {
        forwardDate: true,
      });
    }

    // --- CORRECTION ICI ---
    // J'ai ajouté "forwardDate: true" dans les options.
    // Cela force l'anglais (et le français) à calculer le temps vers le FUTUR
    // pour des phrases comme "in 2 minutes" ou "dans 2 minutes".
    return this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as any);
  }

  hasTimeComponent(text: string): boolean {
    if (!this.chronos) return false;

    for (const c of this.chronos) {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
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