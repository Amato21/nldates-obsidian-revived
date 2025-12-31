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
  
  // --- 1. REGEX : DÉTECTION DES DÉLAIS (in X ...) ---
  // Gère : m, min, h, hours, d, days, w, weeks, M, months, y, years
  regexRelative = /^\s*(?:in|dans)\s+(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours|heures?|d|day|days|jours?|w|week|weeks|semaines?|M|month|months|mois|y|yr|yrs|years?|ans?|années?)\s*$/i;

  // --- 2. REGEX : DÉTECTION DES JOURS (this/next/last ...) ---
  // Gère : monday, mon, tuesday, tue...
  regexWeekday = /^\s*(this|next|last|ce|prochain|dernier)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*$/i;

  constructor(languages: string[]) {
    this.chronos = getChronos(languages);
  }

  // --- FONCTION UTILITAIRE : CONVERSION NOM DE JOUR → INDICE NUMÉRIQUE ---
  // Convertit les noms de jours (anglais ou français) en indices numériques (0-6)
  // Moment.js utilise : 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi
  private getDayOfWeekIndex(dayName: string): number {
    const normalized = dayName.toLowerCase();
    
    // Mapping des noms de jours vers indices (0=dimanche, 1=lundi, etc.)
    const dayMap: { [key: string]: number } = {
      // Anglais
      'sunday': 0, 'sun': 0,
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2, 'tues': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6,
      // Français
      'dimanche': 0,
      'lundi': 1,
      'mardi': 2,
      'mercredi': 3,
      'jeudi': 4,
      'vendredi': 5,
      'samedi': 6,
    };
    
    return dayMap[normalized] ?? 0; // Par défaut dimanche si non reconnu
  }

  // --- MOTEUR PRINCIPAL ---
  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const text = selectedText.toLowerCase().trim();

    // ============================================================
    // NIVEAU 1 : LES MOTS-CLÉS IMMÉDIATS (Vitesse et Précision)
    // ============================================================
    if (text === 'now' || text === 'maintenant') {
        return new Date();
    }
    if (text === 'today' || text === 'aujourd\'hui') {
        return new Date();
    }
    if (text === 'tomorrow' || text === 'demain') {
        return window.moment().add(1, 'days').toDate();
    }
    if (text === 'yesterday' || text === 'hier') {
        return window.moment().subtract(1, 'days').toDate();
    }

    // ============================================================
    // NIVEAU 2 : LE CALCUL RELATIF (in 2 minutes, in 1 year...)
    // ============================================================
    const relMatch = selectedText.match(this.regexRelative);
    if (relMatch) {
        const value = parseInt(relMatch[1]);
        const unitStr = relMatch[2].toLowerCase();
        let unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (unitStr.startsWith('h')) unit = 'hours';
        else if (unitStr.startsWith('d') || unitStr.startsWith('j')) unit = 'days';
        else if (unitStr.startsWith('w') || unitStr.startsWith('s')) unit = 'weeks';
        else if (unitStr === 'm' || unitStr.startsWith('min')) unit = 'minutes';
        else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) unit = 'months';
        else if (unitStr.startsWith('y') || unitStr.startsWith('a')) unit = 'years';

        // MomentJS gère les sauts d'années parfaitement
        return window.moment().add(value, unit).toDate();
    }

    // ============================================================
    // NIVEAU 3 : LES JOURS DE LA SEMAINE (next friday...)
    // ============================================================
    const weekMatch = selectedText.match(this.regexWeekday);
    if (weekMatch) {
        const prefix = weekMatch[1].toLowerCase();
        const dayName = weekMatch[2].toLowerCase();
        
        let m = window.moment();
        
        // Convertir le nom de jour en indice numérique pour éviter les problèmes de locale
        const dayIndex = this.getDayOfWeekIndex(dayName);
        
        if (prefix === 'this' || prefix === 'ce') {
            m.day(dayIndex);
        } else if (prefix === 'next' || prefix === 'prochain') {
            m.add(1, 'weeks').day(dayIndex);
        } else if (prefix === 'last' || prefix === 'dernier') {
            m.subtract(1, 'weeks').day(dayIndex);
        }
        return m.toDate();
    }

    // ============================================================
    // NIVEAU 4 : LE RESTE (Librairie Chrono-node + Fallback)
    // ============================================================
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    // On utilise la technique du "Meilleur Score" pour choisir entre EN et FR
    const initialParse = this.getParsedResult(selectedText);
    if (!initialParse || initialParse.length === 0) {
        // Sécurité ultime : si rien n'est compris, on renvoie aujourd'hui
        return new Date();
    }

    // -- Gestion des cas "Next Week" / "Next Month" génériques (non gérés par le Regex) --
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = new Date();

    if (nextDateMatch && nextDateMatch[1] === 'week') {
        // Next week -> Lundi de la semaine prochaine par défaut
        return this.getParsedDateResult(`next ${weekStart}`, referenceDate, { forwardDate: true });
    }
    if (nextDateMatch && nextDateMatch[1] === 'month') {
        // Next month -> 1er du mois prochain
        return window.moment().add(1, 'months').startOf('month').toDate();
    }
    if (nextDateMatch && nextDateMatch[1] === 'year') {
         // Next year -> 1er Janvier de l'année prochaine
        return window.moment().add(1, 'years').startOf('year').toDate();
    }

    // Appel standard à la librairie avec forwardDate forcé
    return this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as any);
  }

  // --- FONCTION UTILITAIRE : QUI A LE MEILLEUR SCORE ? ---
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
      } catch (e) { console.warn(e); }
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
      } catch (e) { console.warn(e); }
    }
    return bestResults;
  }

  // --- DÉTECTION D'HEURE (POUR L'AFFICHAGE) ---
  hasTimeComponent(text: string): boolean {
    // 1. Si c'est "now", OUI.
    if (/^(now|maintenant)$/i.test(text)) return true;

    // 2. Si c'est un délai en HEURES ou MINUTES -> OUI
    const relMatch = text.match(this.regexRelative);
    if (relMatch) {
        const unitStr = relMatch[2].toLowerCase();
        // m, min, minutes, h, hours...
        if (unitStr.startsWith('h') || unitStr === 'm' || unitStr.startsWith('min')) {
            return true;
        }
        // Jours, mois, années -> NON
        return false;
    }

    // 3. Si c'est un jour spécifique (Next Monday) ou Tomorrow -> NON (Généralement on veut juste la date)
    // Si tu veux l'heure pour "Demain", enlève les lignes ci-dessous.
    if (this.regexWeekday.test(text)) return false;
    if (/^(today|tomorrow|yesterday|demain|hier|aujourd'hui)$/i.test(text)) return false;

    // 4. Sinon, on demande à la librairie si elle voit une heure explicite (ex: "Tomorrow at 5pm")
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
      } catch (e) {}
    }
    return false;
  }
}