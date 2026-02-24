import { atom } from "jotai";

export const sidebarOpenAtom = atom(true);
export const contextPanelOpenAtom = atom(true);
export const themeAtom = atom<"light" | "dark">("dark");
export const onboardingCompleteAtom = atom(false);
