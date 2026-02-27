import { atom } from "jotai";

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  padding: number;
  scrollback: number;
  cursorStyle: "bar" | "block" | "underline";
  cursorWidth: number;
  cursorBlink: boolean;
}

export const TERMINAL_DEFAULTS: TerminalSettings = {
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  lineHeight: 1.0,
  letterSpacing: 0,
  padding: 12,
  scrollback: 5000,
  cursorStyle: "bar",
  cursorWidth: 2,
  cursorBlink: true,
};

export const terminalSettingsAtom = atom<TerminalSettings>(TERMINAL_DEFAULTS);

export const terminalSettingsOpenAtom = atom(false);
