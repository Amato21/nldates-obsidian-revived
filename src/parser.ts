import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import getChronos from "./chrono";
import t from "./lang/helper";

import { DayOfWeek } from "./settings";
import {
  getLocaleWeekStart,
  getWeekNumber,
} from "./utils";


// Type alias for Moment from the moment library bundled with Obsidian
// Using the type from the moment library types since moment is bundled with Obsidian
// The moment package is bundled with Obsidian, but the Moment type is not exported from obsidian module
type Moment = import("moment").Moment;

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: Moment;
}

export interface NLDRangeResult {
  formattedString: string;
  startDate: Date;
  endDate: Date;
  startMoment: Moment;
  endMoment: Moment;
  isRange: true;
  dateList?: Moment[]; // Liste de toutes les dates dans la plage
}

export default class NLDParser {
  chronos: Chrono[];
  languages: string[];
  
  // Regex dynamiques générées à partir des traductions
  regexRelative: RegExp;
  regexRelativeCombined: RegExp; // Pour "in 2 weeks and 3 days"
  regexWeekday: RegExp;
  regexWeekdayWithTime: RegExp; // Pour "next Monday at 3pm"
  regexDateRange: RegExp; // Pour "from Monday to Friday"
  
  // Mots-clés pour toutes les langues
  immediateKeywords: Set<string>;
  prefixKeywords: { this: Set<string>; next: Set<string>; last: Set<string> };
  timeUnitMap: Map<string, 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'>;

  constructor(languages: string[]) {
    this.languages = languages;
    this.chronos = getChronos(languages);
    this.initializeRegex();
    this.initializeKeywords();
  }

  // Initialise les regex dynamiques à partir des traductions
  private initializeRegex(): void {
    // Collecter tous les mots "in" pour toutes les langues
    const inWords: string[] = [];
    const nextWords: string[] = [];
    const lastWords: string[] = [];
    const thisWords: string[] = [];
    const weekdays: string[] = [];
    
    // Collecter les unités de temps de toutes les langues
    const timeUnits: string[] = [];

    for (const lang of this.languages) {
      // Collecter "in"
      const inWord = t("in", lang);
      if (inWord && inWord !== "NOTFOUND") {
        inWords.push(...inWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      // Collecter "next", "last", "this"
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWords.push(...nextWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWords.push(...lastWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const thisWord = t("this", lang);
      if (thisWord && thisWord !== "NOTFOUND") {
        thisWords.push(...thisWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      // Collecter les jours de la semaine
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of days) {
        const dayWord = t(day, lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          weekdays.push(dayWord.toLowerCase());
        }
      }
      
      // Collecter les unités de temps
      const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
      for (const unitKey of timeUnitKeys) {
        const unitWord = t(unitKey, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          timeUnits.push(...unitWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }
    }

    // Collecter les mots "and", "at", "from" et "to" pour toutes les langues
    const andWords: string[] = [];
    const atWords: string[] = [];
    const fromWords: string[] = [];
    const toWords: string[] = [];
    
    for (const lang of this.languages) {
      const andWord = t("and", lang);
      if (andWord && andWord !== "NOTFOUND") {
        andWords.push(...andWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const atWord = t("at", lang);
      if (atWord && atWord !== "NOTFOUND") {
        atWords.push(...atWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const fromWord = t("from", lang);
      if (fromWord && fromWord !== "NOTFOUND") {
        fromWords.push(...fromWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const toWord = t("to", lang);
      if (toWord && toWord !== "NOTFOUND") {
        toWords.push(...toWord.split("|").map(w => w.trim()).filter(w => w));
      }
    }

    // Créer les regex avec échappement des caractères spéciaux
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inPattern = [...new Set(inWords.map(escapeRegex))].join('|');
    const prefixPattern = [...new Set([...thisWords, ...nextWords, ...lastWords].map(escapeRegex))].join('|');
    const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
    const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
    const andPattern = [...new Set(andWords.map(escapeRegex))].join('|');
    const atPattern = [...new Set(atWords.map(escapeRegex))].join('|');
    const fromPattern = [...new Set(fromWords.map(escapeRegex))].join('|');
    const toPattern = [...new Set(toWords.map(escapeRegex))].join('|');

    // Regex simple pour "in 2 minutes"
    this.regexRelative = new RegExp(
      `^\\s*(?:${inPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s*$`,
      'i'
    );

    // Regex pour les combinaisons "in 2 weeks and 3 days"
    this.regexRelativeCombined = new RegExp(
      `^\\s*(?:${inPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s+(?:${andPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s*$`,
      'i'
    );

    // Regex simple pour "next Monday"
    this.regexWeekday = new RegExp(
      `^\\s*(${prefixPattern})\\s+(${weekdayPattern})\\s*$`,
      'i'
    );

    // Regex pour "next Monday at 3pm" - capture le jour et l'heure
    this.regexWeekdayWithTime = new RegExp(
      `^\\s*(${prefixPattern})\\s+(${weekdayPattern})\\s+(?:${atPattern})\\s+(.+)$`,
      'i'
    );

    // Regex pour "from Monday to Friday" - capture deux jours de la semaine
    this.regexDateRange = new RegExp(
      `^\\s*(?:${fromPattern})\\s+(${weekdayPattern})\\s+(?:${toPattern})\\s+(${weekdayPattern})\\s*$`,
      'i'
    );
  }

  // Initialise les mots-clés pour la détection rapide
  private initializeKeywords(): void {
    this.immediateKeywords = new Set();
    this.prefixKeywords = {
      this: new Set(),
      next: new Set(),
      last: new Set(),
    };
    this.timeUnitMap = new Map();

    for (const lang of this.languages) {
      // Mots-clés immédiats
      ['now', 'today', 'tomorrow', 'yesterday'].forEach(key => {
        const word = t(key, lang);
        if (word && word !== "NOTFOUND") {
          this.immediateKeywords.add(word.toLowerCase());
        }
      });

      // Préfixes
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWord.split("|").forEach(w => this.prefixKeywords.next.add(w.trim().toLowerCase()));
      }
      
      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWord.split("|").forEach(w => this.prefixKeywords.last.add(w.trim().toLowerCase()));
      }
      
      const thisWord = t("this", lang);
      if (thisWord && thisWord !== "NOTFOUND") {
        thisWord.split("|").forEach(w => this.prefixKeywords.this.add(w.trim().toLowerCase()));
      }
      
      // Unités de temps avec mapping vers les unités Moment.js
      const unitMappings: { key: string; momentUnit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' }[] = [
        { key: 'minute', momentUnit: 'minutes' },
        { key: 'hour', momentUnit: 'hours' },
        { key: 'day', momentUnit: 'days' },
        { key: 'week', momentUnit: 'weeks' },
        { key: 'month', momentUnit: 'months' },
        { key: 'year', momentUnit: 'years' },
      ];
      
      for (const mapping of unitMappings) {
        const unitWord = t(mapping.key, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          unitWord.split("|").forEach(w => {
            const trimmed = w.trim().toLowerCase();
            if (trimmed) {
              this.timeUnitMap.set(trimmed, mapping.momentUnit);
            }
          });
        }
      }
    }
  }

  // --- FONCTION UTILITAIRE : CONVERSION NOM DE JOUR → INDICE NUMÉRIQUE ---
  // Convertit les noms de jours de toutes les langues en indices numériques (0-6)
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
    };
    
    // Ajouter les jours de toutes les langues activées
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayKeys.length; i++) {
      for (const lang of this.languages) {
        const dayWord = t(dayKeys[i], lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          dayMap[dayWord.toLowerCase()] = i;
        }
      }
    }
    
    return dayMap[normalized] ?? 0; // Par défaut dimanche si non reconnu
  }

  // --- MOTEUR PRINCIPAL ---
  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const text = selectedText.toLowerCase().trim();

    // ============================================================
    // NIVEAU 1 : LES MOTS-CLÉS IMMÉDIATS (Vitesse et Précision)
    // ============================================================
    if (this.immediateKeywords.has(text)) {
        // Vérifier "now" dans toutes les langues
        for (const lang of this.languages) {
            if (t('now', lang).toLowerCase() === text) {
                return new Date();
            }
        }
        // Vérifier "today" dans toutes les langues
        for (const lang of this.languages) {
            if (t('today', lang).toLowerCase() === text) {
                return new Date();
            }
        }
        // Vérifier "tomorrow" dans toutes les langues
        for (const lang of this.languages) {
            if (t('tomorrow', lang).toLowerCase() === text) {
                return window.moment().add(1, 'days').toDate();
            }
        }
        // Vérifier "yesterday" dans toutes les langues
        for (const lang of this.languages) {
            if (t('yesterday', lang).toLowerCase() === text) {
                return window.moment().subtract(1, 'days').toDate();
            }
        }
    }

    // ============================================================
    // NIVEAU 2 : LE CALCUL RELATIF (in 2 minutes, in 1 year...)
    // ============================================================
    // D'abord vérifier les combinaisons "in 2 weeks and 3 days"
    const relCombinedMatch = selectedText.match(this.regexRelativeCombined);
    if (relCombinedMatch) {
        const value1 = parseInt(relCombinedMatch[1]);
        const unitStr1 = relCombinedMatch[2].toLowerCase().trim();
        const value2 = parseInt(relCombinedMatch[3]);
        const unitStr2 = relCombinedMatch[4].toLowerCase().trim();
        
        // Chercher les unités dans le mapping des traductions
        let unit1: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        let unit2: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (this.timeUnitMap.has(unitStr1)) {
            unit1 = this.timeUnitMap.get(unitStr1)!;
        } else {
            // Fallback pour les abréviations communes
            if (unitStr1.startsWith('h')) unit1 = 'hours';
            else if (unitStr1.startsWith('d') || unitStr1.startsWith('j')) unit1 = 'days';
            else if (unitStr1.startsWith('w') || unitStr1.startsWith('s')) unit1 = 'weeks';
            else if (unitStr1 === 'm' || unitStr1.startsWith('min')) unit1 = 'minutes';
            else if (unitStr1.startsWith('mo') || unitStr1 === 'M' || unitStr1.startsWith('mois')) unit1 = 'months';
            else if (unitStr1.startsWith('y') || unitStr1.startsWith('a')) unit1 = 'years';
        }
        
        if (this.timeUnitMap.has(unitStr2)) {
            unit2 = this.timeUnitMap.get(unitStr2)!;
        } else {
            // Fallback pour les abréviations communes
            if (unitStr2.startsWith('h')) unit2 = 'hours';
            else if (unitStr2.startsWith('d') || unitStr2.startsWith('j')) unit2 = 'days';
            else if (unitStr2.startsWith('w') || unitStr2.startsWith('s')) unit2 = 'weeks';
            else if (unitStr2 === 'm' || unitStr2.startsWith('min')) unit2 = 'minutes';
            else if (unitStr2.startsWith('mo') || unitStr2 === 'M' || unitStr2.startsWith('mois')) unit2 = 'months';
            else if (unitStr2.startsWith('y') || unitStr2.startsWith('a')) unit2 = 'years';
        }

        // Additionner les deux durées
        const resultDate = window.moment().add(value1, unit1).add(value2, unit2).toDate();
        return resultDate;
    }
    
    // Ensuite vérifier les expressions simples "in 2 minutes"
    const relMatch = selectedText.match(this.regexRelative);
    if (relMatch) {
        const value = parseInt(relMatch[1]);
        const unitStr = relMatch[2].toLowerCase().trim();
        
        // Chercher l'unité dans le mapping des traductions
        let unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (this.timeUnitMap.has(unitStr)) {
            unit = this.timeUnitMap.get(unitStr)!;
        } else {
            // Fallback pour les abréviations communes si pas trouvé dans les traductions
            if (unitStr.startsWith('h')) unit = 'hours';
            else if (unitStr.startsWith('d') || unitStr.startsWith('j')) unit = 'days';
            else if (unitStr.startsWith('w') || unitStr.startsWith('s')) unit = 'weeks';
            else if (unitStr === 'm' || unitStr.startsWith('min')) unit = 'minutes';
            else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) unit = 'months';
            else if (unitStr.startsWith('y') || unitStr.startsWith('a')) unit = 'years';
        }

        // MomentJS gère les sauts d'années parfaitement
        return window.moment().add(value, unit).toDate();
    }

    // ============================================================
    // NIVEAU 2.5 : LES PLAGES DE DATES (from Monday to Friday)
    // ============================================================
    // Vérifier "from Monday to Friday"
    const rangeMatch = selectedText.match(this.regexDateRange);
    if (rangeMatch) {
        const startDayName = rangeMatch[1].toLowerCase();
        const endDayName = rangeMatch[2].toLowerCase();
        
        const m = window.moment();
        const startDayIndex = this.getDayOfWeekIndex(startDayName);
        const endDayIndex = this.getDayOfWeekIndex(endDayName);
        
        // Trouver le prochain jour de début
        let startMoment = window.moment().day(startDayIndex);
        if (startMoment.isBefore(m, 'day')) {
            startMoment.add(1, 'week');
        }
        
        // Trouver le prochain jour de fin (peut être dans la même semaine ou la suivante)
        let endMoment = window.moment().day(endDayIndex);
        if (endMoment.isBefore(startMoment, 'day')) {
            endMoment.add(1, 'week');
        }
        
        // Retourner la date de début (pour compatibilité, mais on devrait utiliser getParsedDateRange)
        return startMoment.toDate();
    }

    // ============================================================
    // NIVEAU 3 : LES JOURS DE LA SEMAINE (next friday...)
    // ============================================================
    // D'abord vérifier "next Monday at 3pm"
    const weekWithTimeMatch = selectedText.match(this.regexWeekdayWithTime);
    if (weekWithTimeMatch) {
        const prefix = weekWithTimeMatch[1].toLowerCase();
        const dayName = weekWithTimeMatch[2].toLowerCase();
        const timePart = weekWithTimeMatch[3].trim();
        
        const m = window.moment();
        
        // Convertir le nom de jour en indice numérique pour éviter les problèmes de locale
        const dayIndex = this.getDayOfWeekIndex(dayName);
        
        if (this.prefixKeywords.this.has(prefix)) {
            m.day(dayIndex);
        } else if (this.prefixKeywords.next.has(prefix)) {
            m.add(1, 'weeks').day(dayIndex);
        } else if (this.prefixKeywords.last.has(prefix)) {
            m.subtract(1, 'weeks').day(dayIndex);
        }
        
        // Parser l'heure avec chrono-node
        const timeResult = this.getParsedDateResult(timePart, m.toDate());
        if (timeResult) {
            return timeResult;
        }
        
        // Si le parsing de l'heure échoue, retourner juste la date
        return m.toDate();
    }
    
    // Ensuite vérifier les expressions simples "next Monday"
    const weekMatch = selectedText.match(this.regexWeekday);
    if (weekMatch) {
        const prefix = weekMatch[1].toLowerCase();
        const dayName = weekMatch[2].toLowerCase();
        
        const m = window.moment();
        
        // Convertir le nom de jour en indice numérique pour éviter les problèmes de locale
        const dayIndex = this.getDayOfWeekIndex(dayName);
        
        if (this.prefixKeywords.this.has(prefix)) {
            m.day(dayIndex);
        } else if (this.prefixKeywords.next.has(prefix)) {
            m.add(1, 'weeks').day(dayIndex);
        } else if (this.prefixKeywords.last.has(prefix)) {
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

    // -- Gestion des cas "Next Month" / "Next Year" génériques (non gérés par le Regex) --
    // Note: "Next Week" est maintenant géré par getParsedDateRange pour générer une liste de dates
    // Créer un pattern pour "next" dans toutes les langues
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const nextDateMatch = selectedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = new Date();

    if (nextDateMatch) {
        const period = nextDateMatch[2].toLowerCase();
        // Vérifier si c'est "week" - si oui, laisser getParsedDateRange le gérer
        let isNextWeek = false;
        for (const lang of this.languages) {
            if (period === t('week', lang).toLowerCase()) {
                isNextWeek = true;
                break;
            }
        }
        // Si c'est "next week", on laisse getParsedDateRange le gérer
        if (isNextWeek) {
            // Continuer avec le parsing standard qui va échouer, permettant à getParsedDateRange de prendre le relais
        } else {
            // Vérifier si c'est "month" ou "year" dans toutes les langues
            for (const lang of this.languages) {
                if (period === t('month', lang).toLowerCase()) {
                    // Next month -> 1er du mois prochain
                    return window.moment().add(1, 'months').startOf('month').toDate();
                }
                if (period === t('year', lang).toLowerCase()) {
                    // Next year -> 1er Janvier de l'année prochaine
                    return window.moment().add(1, 'years').startOf('year').toDate();
                }
            }
        }
    }

    // Appel standard à la librairie avec forwardDate forcé
    const chronoResult = this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as ParsingOption);
    return chronoResult;
  }

  // --- MÉTHODE POUR PARSER LES PLAGES DE DATES ---
  getParsedDateRange(selectedText: string, weekStartPreference: DayOfWeek): NLDRangeResult | null {
    const text = selectedText.toLowerCase().trim();
    
    // Vérifier "from Monday to Friday"
    const rangeMatch = selectedText.match(this.regexDateRange);
    if (rangeMatch) {
      const startDayName = rangeMatch[1].toLowerCase();
      const endDayName = rangeMatch[2].toLowerCase();
      
      const m = window.moment();
      const startDayIndex = this.getDayOfWeekIndex(startDayName);
      const endDayIndex = this.getDayOfWeekIndex(endDayName);
      
      // Trouver le prochain jour de début
      let startMoment = window.moment().day(startDayIndex);
      if (startMoment.isBefore(m, 'day')) {
        startMoment.add(1, 'week');
      }
      
      // Trouver le prochain jour de fin (doit être après ou égal au jour de début)
      let endMoment = window.moment().day(endDayIndex);
      // Si le jour de fin est avant le jour de début, on prend celui de la semaine suivante
      if (endMoment.isBefore(startMoment, 'day')) {
        endMoment.add(1, 'week');
      }
      // S'assurer que endMoment est toujours après ou égal à startMoment
      if (endMoment.isBefore(startMoment, 'day')) {
        endMoment = startMoment.clone().add(1, 'week').day(endDayIndex);
      }
      
      const format = "YYYY-MM-DD";
      const startFormatted = startMoment.format(format);
      const endFormatted = endMoment.format(format);
      
      // Générer la liste de toutes les dates dans la plage
      const dateList: Moment[] = [];
      let currentMoment = startMoment.clone();
      while (currentMoment.isSameOrBefore(endMoment, 'day')) {
        dateList.push(currentMoment.clone());
        currentMoment.add(1, 'day');
      }
      
      const result: NLDRangeResult = {
        formattedString: `${startFormatted} to ${endFormatted}`,
        startDate: startMoment.toDate(),
        endDate: endMoment.toDate(),
        startMoment: startMoment.clone(),
        endMoment: endMoment.clone(),
        isRange: true as const,
        dateList: dateList,
      };
      return result;
    }
    
    // Vérifier "next week" comme plage
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const nextWeekMatch = selectedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));
    if (nextWeekMatch) {
      const period = nextWeekMatch[2].toLowerCase();
      for (const lang of this.languages) {
        if (period === t('week', lang).toLowerCase()) {
          // Next week -> retourner du lundi au dimanche de la semaine prochaine
          const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
          const weekStartIndex = this.getDayOfWeekIndex(String(weekStart));
          
          const startMoment = window.moment().add(1, 'weeks').day(weekStartIndex);
          const endMoment = startMoment.clone().add(6, 'days');
          
          const format = "YYYY-MM-DD";
          const startFormatted = startMoment.format(format);
          const endFormatted = endMoment.format(format);
          
          // Générer la liste de toutes les dates dans la plage
          const dateList: Moment[] = [];
          let currentMoment = startMoment.clone();
          while (currentMoment.isSameOrBefore(endMoment, 'day')) {
            dateList.push(currentMoment.clone());
            currentMoment.add(1, 'day');
          }
          
          const result: NLDRangeResult = {
            formattedString: `${startFormatted} to ${endFormatted}`,
            startDate: startMoment.toDate(),
            endDate: endMoment.toDate(),
            startMoment: startMoment.clone(),
            endMoment: endMoment.clone(),
            isRange: true as const,
            dateList: dateList,
          };
          return result;
        }
      }
    }
    
    return null;
  }

  // --- FONCTION UTILITAIRE : QUI A LE MEILLEUR SCORE ? ---
  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();
    let bestResult: ParsedResult | null = null;
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
    // 1. Si c'est "now" dans n'importe quelle langue, OUI.
    const nowWords = Array.from(this.immediateKeywords).filter(w => 
      this.languages.some(lang => t('now', lang).toLowerCase() === w)
    );
    if (nowWords.some(w => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(text))) {
      return true;
    }

    // 2. Vérifier d'abord les combinaisons "in X weeks and Y days"
    const relCombinedMatch = text.match(this.regexRelativeCombined);
    if (relCombinedMatch) {
        const unitStr1 = relCombinedMatch[2].toLowerCase();
        const unitStr2 = relCombinedMatch[4].toLowerCase();
        // Si l'une des unités est heures ou minutes -> OUI
        if (unitStr1.startsWith('h') || unitStr1 === 'm' || unitStr1.startsWith('min') ||
            unitStr2.startsWith('h') || unitStr2 === 'm' || unitStr2.startsWith('min')) {
            return true;
        }
        // Sinon -> NON (jours, semaines, mois, années)
        return false;
    }

    // 3. Si c'est un délai simple en HEURES ou MINUTES -> OUI
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

    // 4. Si c'est un jour spécifique avec heure (Next Monday at 3pm) -> OUI
    if (this.regexWeekdayWithTime && this.regexWeekdayWithTime.test(text)) {
      return true;
    }
    
    // 5. Si c'est un jour spécifique sans heure (Next Monday) ou Tomorrow -> NON (Généralement on veut juste la date)
    // Si tu veux l'heure pour "Demain", enlève les lignes ci-dessous.
    if (this.regexWeekday.test(text)) {
      return false;
    }
    
    // Vérifier les mots-clés today/tomorrow/yesterday dans toutes les langues
    const dateKeywords = ['today', 'tomorrow', 'yesterday'];
    const dateWords: string[] = [];
    for (const key of dateKeywords) {
      for (const lang of this.languages) {
        const word = t(key, lang);
        if (word && word !== "NOTFOUND") {
          dateWords.push(word.toLowerCase());
        }
      }
    }
    if (dateWords.some(w => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(text))) {
      return false;
    }

    // 6. Sinon, on demande à la librairie si elle voit une heure explicite (ex: "Tomorrow at 5pm")
    if (!this.chronos) {
      return false;
    }
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
        // Ignore parsing errors
      }
    }
    return false;
  }
}