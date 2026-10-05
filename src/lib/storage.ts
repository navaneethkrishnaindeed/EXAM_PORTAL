import type { Exam, Sitting } from "../types/exam";

const PAPERS_KEY = "exam-studio:papers";
const SITTING_KEY = "exam-studio:sitting";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadPapers(): Exam[] {
  const raw = read(PAPERS_KEY);
  return Array.isArray(raw) ? (raw as Exam[]) : [];
}

export function savePapers(papers: Exam[]): void {
  localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
}

export function loadSitting(): Sitting | null {
  const raw = read(SITTING_KEY);
  if (!raw || typeof raw !== "object") return null;
  const sitting = raw as Sitting;
  if (!sitting.exam || !sitting.attempt) return null;
  return sitting;
}

export function saveSitting(sitting: Sitting | null): void {
  if (!sitting) {
    localStorage.removeItem(SITTING_KEY);
    return;
  }
  localStorage.setItem(SITTING_KEY, JSON.stringify(sitting));
}
