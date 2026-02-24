import { atom } from "jotai";

export interface Session {
  id: string;
  toolSlug: string;
  command: string;
  args: string[];
  status: "running" | "ended";
  startedAt: number;
  endedAt?: number;
}

export const sessionsAtom = atom<Session[]>([]);
export const activeSessionIdAtom = atom<string | null>(null);

export const activeSessionAtom = atom((get) => {
  const id = get(activeSessionIdAtom);
  if (!id) return null;
  return get(sessionsAtom).find((s) => s.id === id) ?? null;
});
