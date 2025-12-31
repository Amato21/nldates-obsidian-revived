import * as moment from "obsidian";

declare global {
  interface Window {
    moment: typeof moment;
  }
}

export {};

