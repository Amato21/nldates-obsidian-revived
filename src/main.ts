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
  // @ts-ignore
  private parser: NLDParser;
  public settings: NLDSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "nlp-dates",
      name: "Parse natural language date",
      callback: () => getParseCommand(this, "replace"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-dates-link",
      name: "Parse natural language date (as link)",
      callback: () => getParseCommand(this, "link"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-date-clean",
      name: "Parse natural language date (as plain text)",
      callback: () => getParseCommand(this, "clean"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-parse-time",
      name: "Parse natural language time",
      callback: () => getParseCommand(this, "time"),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-now",
      name: "Insert the current date and time",
      callback: () => getNowCommand(this),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-today",
      name: "Insert the current date",
      callback: () => getCurrentDateCommand(this),
      hotkeys: [],
    });

    this.addCommand({
      id: "nlp-time",
      name: "Insert the current time",
      callback: () => getCurrentTimeCommand(this),
      hotkeys: [],
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
      hotkeys: [],
    });

    this.addSettingTab(new NLDSettingsTab(this.app, this));
    this.registerObsidianProtocolHandler("nldates", this.actionHandler.bind(this));
    this.registerEditorSuggest(new DateSuggest(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      // initialize the parser when layout is ready so that the correct locale is used
      this.resetParser();
    });
  }

  async resetParser(): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:94',message:'resetParser called',data:{languages:this.settings.languages,languagesLength:this.settings.languages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    this.parser = new NLDParser(this.settings.languages);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:94',message:'resetParser completed',data:{parserExists:!!this.parser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  }

  onunload(): void {
    console.log("Unloading natural language date parser plugin");
  }

  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:102',message:'loadSettings entry',data:{loadedData:loadedData,defaultLanguages:DEFAULT_SETTINGS.languages,defaultEnglish:DEFAULT_SETTINGS.english},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:102',message:'loadSettings after merge',data:{settingsLanguages:this.settings.languages,settingsEnglish:this.settings.english,settingsFrench:this.settings.french},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    // S'assurer que languages n'est pas vide (utiliser les valeurs par défaut si nécessaire)
    if (!this.settings.languages || this.settings.languages.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:102',message:'languages array is empty, resetting to default',data:{settingsLanguages:this.settings.languages},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      this.settings.languages = [...DEFAULT_SETTINGS.languages];
    }
    
    // Synchroniser les flags avec le tableau languages si nécessaire
    this.syncLanguageFlags();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d0f280c-c24d-45f9-a1b0-98f0df462ad5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:102',message:'loadSettings after sync',data:{settingsLanguages:this.settings.languages,settingsEnglish:this.settings.english,settingsFrench:this.settings.french},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
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
    };
    
    // Réinitialiser tous les flags
    this.settings.english = false;
    this.settings.japanese = false;
    this.settings.french = false;
    this.settings.german = false;
    this.settings.portuguese = false;
    this.settings.dutch = false;
    
    // Activer les flags correspondant aux langues dans le tableau
    for (const lang of this.settings.languages) {
      const flagKey = languageMap[lang];
      if (flagKey) {
        // @ts-ignore
        this.settings[flagKey] = true;
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
      
      // TIP: Here we format “Date TIME.”
      // But BEWARE: it is the “date-suggest.ts” file that will add the [[ ]].
      // If we don't touch date-suggest, it will make [[Date Time]].
      // To make [[Date]] Time, we have to be clever.
      
      formatToUse = `${formatToUse} ${timeFormat}`;
    }

    return this.parse(dateString, formatToUse);
  }

  parseTime(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.timeFormat);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    const date = this.parseDate(params.day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      workspace.getLeaf(newPane).openFile(dailyNote);
    }
  }
}