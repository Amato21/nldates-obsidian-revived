import { MarkdownView } from "obsidian";
import { adjustCursor, getSelectedText } from "./utils";
import NaturalLanguageDates from "./main";
import t from "./lang/helper";

export function getParseCommand(plugin: NaturalLanguageDates, mode: string): void {
  const { workspace } = plugin.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);

  // The active view might not be a markdown view
  if (!activeView) {
    return;
  }

  const editor = activeView.editor;
  const cursor = editor.getCursor();
  const selectedText = getSelectedText(editor);

  // Vérifier d'abord si c'est une plage de dates
  const dateRange = plugin.parseDateRange(selectedText);
  if (dateRange) {
    // C'est une plage de dates
    let newStr = "";
    
    // Si on a une liste de dates, générer une liste de liens au lieu d'une plage
    if (dateRange.dateList && dateRange.dateList.length > 0) {
      const dateLinks = dateRange.dateList.map(moment => {
        const formatted = moment.format(plugin.settings.format);
        if (mode == "replace") {
          return `[[${formatted}]]`;
        } else if (mode == "link") {
          return `[${formatted}](${formatted})`;
        } else {
          return formatted;
        }
      });
      newStr = dateLinks.join(', ');
    } else {
      // Fallback vers l'ancien comportement (plage)
      const startFormatted = dateRange.startMoment.format(plugin.settings.format);
      const endFormatted = dateRange.endMoment.format(plugin.settings.format);
      
      // Obtenir la traduction de "to" selon la langue principale
      const primaryLang = plugin.settings.languages[0] || 'en';
      const toTranslation = t("to", primaryLang).split('|')[0]; // Prendre la première variante
      
      if (mode == "replace") {
        // Générer des liens pour la plage : [[start]] to [[end]]
        newStr = `[[${startFormatted}]] ${toTranslation} [[${endFormatted}]]`;
      } else if (mode == "link") {
        // Lien Markdown standard
        newStr = `[${selectedText}](${dateRange.formattedString})`;
      } else if (mode == "clean") {
        // Texte brut sans lien
        newStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
      } else if (mode == "time") {
        // Pas d'heure pour les plages
        newStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
      }
    }
    
    editor.replaceSelection(newStr);
    adjustCursor(editor, cursor, newStr, selectedText);
    editor.focus();
    return;
  }

  // Sinon, traiter comme une date normale
  const date = plugin.parseDate(selectedText);

  if (!date.moment.isValid()) {
    // Do nothing
    editor.setCursor({
      line: cursor.line,
      ch: cursor.ch,
    });
    return;
  }

  // --- MODIFICATION INTELLIGENTE V0.9 ---
  // On vérifie si une heure est présente dans le texte sélectionné
  const hasTime = plugin.hasTimeComponent(selectedText);

  let newStr = "";

  if (mode == "replace") {
    // C'est le mode par défaut (Create Link)
    if (hasTime) {
        // CAS HYBRIDE : [[Date]] Heure
        const datePart = date.moment.format(plugin.settings.format);
        // Si l'utilisateur n'a pas mis de format d'heure, on force HH:mm par sécurité
        const timePart = date.moment.format(plugin.settings.timeFormat || "HH:mm");
        
        newStr = `[[${datePart}]] ${timePart}`;
    } else {
        // CAS CLASSIQUE : [[Date]]
        newStr = `[[${date.formattedString}]]`;
    }
  } else if (mode == "link") {
    // Lien Markdown standard [texte](date)
    newStr = `[${selectedText}](${date.formattedString})`;
  } else if (mode == "clean") {
    // Texte brut sans lien
    newStr = `${date.formattedString}`;
  } else if (mode == "time") {
    // Juste l'heure
    const time = plugin.parseTime(selectedText);
    newStr = `${time.formattedString}`;
  }

  editor.replaceSelection(newStr);
  adjustCursor(editor, cursor, newStr, selectedText);
  editor.focus();
}

export function insertMomentCommand(
  plugin: NaturalLanguageDates,
  date: Date,
  format: string
) {
  const { workspace } = plugin.app;
  const activeView = workspace.getActiveViewOfType(MarkdownView);

  if (activeView) {
    // The active view might not be a markdown view
    const editor = activeView.editor;
    editor.replaceSelection(window.moment(date).format(format));
  }
}

export function getNowCommand(plugin: NaturalLanguageDates): void {
  const format = `${plugin.settings.format}${plugin.settings.separator}${plugin.settings.timeFormat}`;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentDateCommand(plugin: NaturalLanguageDates): void {
  const format = plugin.settings.format;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentTimeCommand(plugin: NaturalLanguageDates): void {
  const format = plugin.settings.timeFormat;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}