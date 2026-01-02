import { MarkdownView, ObsidianProtocolData, Plugin } from "obsidian";

import DatePickerModal from "./modals/date-picker";
import NLDParser, { NLDResult } from "./parser";
import { NLDSettingsTab, NLDSettings, DEFAULT_SETTINGS } from "./settings";
import DateSuggest from "./suggest/date-suggest";
import {
  getParseCommand,
  getCurrentDateCommand,
  getCurrentTimeCommand,
  getNowCommand,
} from "./commands";
import { getFormattedDate, getOrCreateDailyNote, parseTruthy } from "./utils";

export default class NaturalLanguageDates extends Plugin {
  public parser: NLDParser;
  public settings: NLDSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    
    // Initialiser le parser immédiatement (pas besoin d'attendre onLayoutReady)
    this.resetParser();

    this.addCommand({
      id: "nlp-dates",
      name: "Parse natural language date",
      callback: () => getParseCommand(this, "replace"),
    });

    this.addCommand({
      id: "nlp-dates-link",
      name: "Parse natural language date (as link)",
      callback: () => getParseCommand(this, "link"),
    });

    this.addCommand({
      id: "nlp-date-clean",
      name: "Parse natural language date (as plain text)",
      callback: () => getParseCommand(this, "clean"),
    });

    this.addCommand({
      id: "nlp-parse-time",
      name: "Parse natural language time",
      callback: () => getParseCommand(this, "time"),
    });

    this.addCommand({
      id: "nlp-now",
      name: "Insert the current date and time",
      callback: () => getNowCommand(this),
    });

    this.addCommand({
      id: "nlp-today",
      name: "Insert the current date",
      callback: () => getCurrentDateCommand(this),
    });

    this.addCommand({
      id: "nlp-time",
      name: "Insert the current time",
      callback: () => getCurrentTimeCommand(this),
    });

    this.addCommand({
      id: "nlp-picker",
      name: "Date picker",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        }
        new DatePickerModal(this.app, this).open();
      },
    });

    this.addSettingTab(new NLDSettingsTab(this.app, this));
    this.registerObsidianProtocolHandler("nldates", this.actionHandler.bind(this));
    this.registerEditorSuggest(new DateSuggest(this.app, this));
  }

  resetParser(): void {
    try {
      this.parser = new NLDParser(this.settings.languages);
    } catch (error) {
      console.error('Failed to initialize parser:', error);
      // Créer un parser avec l'anglais par défaut en cas d'erreur pour éviter que le plugin plante complètement
      this.parser = new NLDParser(['en']);
    }
  }

  onunload(): void {
    // Plugin unloaded
  }

  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    
    // S'assurer que languages n'est pas vide (utiliser les valeurs par défaut si nécessaire)
    if (!this.settings.languages || this.settings.languages.length === 0) {
      this.settings.languages = [...DEFAULT_SETTINGS.languages];
    }
    
    // Synchroniser les flags avec le tableau languages si nécessaire
    this.syncLanguageFlags();
  }

  // Synchronise les flags de langue (english, french, etc.) avec le tableau languages
  private syncLanguageFlags(): void {
    const languageMap: { [key: string]: keyof NLDSettings } = {
      'en': 'english',
      'ja': 'japanese',
      'fr': 'french',
      'de': 'german',
      'pt': 'portuguese',
      'nl': 'dutch',
      'es': 'spanish',
      'it': 'italian',
    };
    
    // Réinitialiser tous les flags
    this.settings.english = false;
    this.settings.japanese = false;
    this.settings.french = false;
    this.settings.german = false;
    this.settings.portuguese = false;
    this.settings.dutch = false;
    this.settings.spanish = false;
    this.settings.italian = false;
    
    // Activer les flags correspondant aux langues dans le tableau
    for (const lang of this.settings.languages) {
      const flagKey = languageMap[lang];
      if (flagKey) {
        (this.settings[flagKey] as boolean) = true;
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /*
    @param dateString: A string that contains a date in natural language, e.g. today, tomorrow, next week
    @param format: A string that contains the formatting string for a Moment
    @returns NLDResult: An object containing the date, a cloned Moment and the formatted string.
  */
  parse(dateString: string, format: string): NLDResult {
    if (!this.parser) {
      // Parser pas encore initialisé, l'initialiser maintenant
      this.resetParser();
    }
    const date = this.parser.getParsedDate(dateString, this.settings.weekStart);
    const formattedString = getFormattedDate(date, format);
    if (formattedString === "Invalid date") {
      console.debug("Input date " + dateString + " can't be parsed by nldates");
    }

    return {
      formattedString,
      date,
      moment: window.moment(date),
    };
  }

  /*
    @param dateString: A string that contains a date in natural language, e.g. today, tomorrow, next week
    @returns NLDResult: An object containing the date, a cloned Moment and the formatted string.
  */
  parseDate(dateString: string): NLDResult {
    // 1. On demande au cerveau si une heure est détectée
    const hasTime = this.parser.hasTimeComponent(dateString);
    let formatToUse = this.settings.format;

    // 2. Si une heure est détectée...
    if (hasTime) {
      const timeFormat = this.settings.timeFormat || "HH:mm";
      
      // TIP: Here we format "Date TIME."
      // But BEWARE: it is the "date-suggest.ts" file that will add the [[ ]].
      // If we don't touch date-suggest, it will make [[Date Time]].
      // To make [[Date]] Time, we have to be clever.
      
      formatToUse = `${formatToUse} ${timeFormat}`;
    }

    const result = this.parse(dateString, formatToUse);
    return result;
  }

  /*
    @param dateString: A string that contains a date range in natural language, e.g. "from Monday to Friday", "next week"
    @returns NLDRangeResult | null: An object containing the date range, or null if not a range
  */
  parseDateRange(dateString: string): import("./parser").NLDRangeResult | null {
    if (!this.parser) {
      this.resetParser();
    }
    return this.parser.getParsedDateRange(dateString, this.settings.weekStart);
  }

  parseTime(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.timeFormat);
  }

  hasTimeComponent(text: string): boolean {
    if (!this.parser) {
      this.resetParser();
    }
    return this.parser.hasTimeComponent(text);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    const date = this.parseDate(params.day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      await workspace.getLeaf(newPane).openFile(dailyNote);
    }
  }
}