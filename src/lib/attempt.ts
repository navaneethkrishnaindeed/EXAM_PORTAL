import type { Attempt, Exam, PaletteStatus, QuestionState } from "../types/exam";
import { findFlat, firstKeyOfSubject, flatten, neighborKey } from "./flatten";

function emptyState(): QuestionState {
  return { visited: false, marked: false, taken: null, draft: [] };
}

export function createAttempt(exam: Exam, now = Date.now()): Attempt {
  const list = flatten(exam);
  const first = list[0];
  const questions: Record<string, QuestionState> = {};
  for (const item of list) {
    questions[item.key] = {
      ...emptyState(),
      visited: item.key === first?.key,
    };
  }
  const subjectRemainingMs: Record<string, number> = {};
  for (const subject of exam.subjects) {
    const minutes = subject.durationMinutes ?? exam.durationMinutes;
    subjectRemainingMs[subject.id] = Math.max(0, Math.round(minutes * 60 * 1000));
  }
  const activeSubjectId = first?.subjectId ?? null;
  return {
    startedAt: now,
    endedAt: null,
    closed: false,
    autoClosed: false,
    timeUp: false,
    currentKey: first?.key ?? "",
    lastKeyBySubject: activeSubjectId && first ? { [activeSubjectId]: first.key } : {},
    questions,
    deadline: exam.timerMode === "exam" ? now + exam.durationMinutes * 60 * 1000 : null,
    subjectRemainingMs,
    activeSubjectId: exam.timerMode === "perSubject" ? activeSubjectId : null,
    activeDeadline:
      exam.timerMode === "perSubject" && activeSubjectId
        ? now + (subjectRemainingMs[activeSubjectId] ?? 0)
        : null,
    lockedSubjects: [],
  };
}

export function closeAttempt(attempt: Attempt, autoClosed: boolean, endedAt: number): Attempt {
  if (attempt.closed) return attempt;
  return { ...attempt, closed: true, autoClosed, timeUp: true, endedAt };
}

export function statusOf(state: QuestionState | undefined): PaletteStatus {
  if (!state?.visited) return "notVisited";
  const answered = !!state.taken?.some((value) => value.trim() !== "");
  if (answered && state.marked) return "answeredMarked";
  if (state.marked) return "marked";
  if (answered) return "answered";
  return "notAnswered";
}

export function countStatuses(states: QuestionState[]): Record<PaletteStatus, number> {
  const counts: Record<PaletteStatus, number> = {
    notVisited: 0,
    notAnswered: 0,
    answered: 0,
    marked: 0,
    answeredMarked: 0,
  };
  for (const state of states) counts[statusOf(state)] += 1;
  return counts;
}

export function remainingMs(exam: Exam, attempt: Attempt, now: number): number {
  if (attempt.closed) return 0;
  if (exam.timerMode === "exam") {
    if (attempt.deadline === null) return 0;
    return Math.max(0, attempt.deadline - now);
  }
  if (!attempt.activeSubjectId) return 0;
  if (attempt.lockedSubjects.includes(attempt.activeSubjectId)) return 0;
  if (attempt.activeDeadline !== null) return Math.max(0, attempt.activeDeadline - now);
  return Math.max(0, attempt.subjectRemainingMs[attempt.activeSubjectId] ?? 0);
}

function finishIfNeeded(exam: Exam, attempt: Attempt, now: number): Attempt {
  if (exam.timerMode === "exam") {
    if (attempt.deadline !== null && now >= attempt.deadline) {
      return exam.autoSubmit ? closeAttempt(attempt, true, attempt.deadline) : { ...attempt, timeUp: true };
    }
    return attempt;
  }
  const allLocked = exam.subjects.every((subject) => attempt.lockedSubjects.includes(subject.id));
  if (!allLocked) return attempt;
  return exam.autoSubmit ? closeAttempt(attempt, true, now) : { ...attempt, timeUp: true };
}

export function lockSubject(exam: Exam, attempt: Attempt, subjectId: string, now: number): Attempt {
  if (attempt.closed || attempt.timeUp) return attempt;
  const locked = attempt.lockedSubjects.includes(subjectId)
    ? attempt.lockedSubjects
    : [...attempt.lockedSubjects, subjectId];
  const subjectRemainingMs = { ...attempt.subjectRemainingMs, [subjectId]: 0 };
  const activeCleared =
    attempt.activeSubjectId === subjectId ? { activeDeadline: null as number | null } : {};
  return finishIfNeeded(exam, { ...attempt, lockedSubjects: locked, subjectRemainingMs, ...activeCleared }, now);
}

export function tickAttempt(exam: Exam, attempt: Attempt, now: number): Attempt {
  if (attempt.closed || attempt.timeUp) return attempt;
  if (exam.timerMode === "exam") {
    if (attempt.deadline !== null && now >= attempt.deadline) {
      return exam.autoSubmit ? closeAttempt(attempt, true, attempt.deadline) : { ...attempt, timeUp: true };
    }
    return attempt;
  }
  if (
    attempt.activeSubjectId &&
    attempt.activeDeadline !== null &&
    now >= attempt.activeDeadline &&
    !attempt.lockedSubjects.includes(attempt.activeSubjectId)
  ) {
    return lockSubject(exam, attempt, attempt.activeSubjectId, now);
  }
  return attempt;
}

export function subjectIsLocked(exam: Exam, attempt: Attempt, subjectId: string): boolean {
  if (attempt.timeUp) return true;
  return exam.timerMode === "perSubject" && attempt.lockedSubjects.includes(subjectId);
}

export function moveTo(exam: Exam, attempt: Attempt, key: string): Attempt {
  if (attempt.closed) return attempt;
  const target = findFlat(exam, key);
  if (!target) return attempt;
  const prev = attempt.questions[key] ?? emptyState();
  return {
    ...attempt,
    currentKey: key,
    lastKeyBySubject: { ...attempt.lastKeyBySubject, [target.subjectId]: key },
    questions: {
      ...attempt.questions,
      [key]: { ...prev, visited: true },
    },
  };
}

export function setDraft(exam: Exam, attempt: Attempt, key: string, draft: string[]): Attempt {
  if (attempt.closed || attempt.timeUp) return attempt;
  const item = findFlat(exam, key);
  if (!item || subjectIsLocked(exam, attempt, item.subjectId)) return attempt;
  const prev = attempt.questions[key] ?? emptyState();
  const intake = item.question.intake ?? exam.intake;
  const taken = intake === "onSelect" ? [...draft] : prev.taken;
  return {
    ...attempt,
    questions: {
      ...attempt.questions,
      [key]: { ...prev, visited: true, draft: [...draft], taken },
    },
  };
}

export function commitCurrent(exam: Exam, attempt: Attempt, key: string, marked: boolean): Attempt {
  if (attempt.closed || attempt.timeUp) return attempt;
  const item = findFlat(exam, key);
  if (!item || subjectIsLocked(exam, attempt, item.subjectId)) return attempt;
  const prev = attempt.questions[key] ?? emptyState();
  return {
    ...attempt,
    questions: {
      ...attempt.questions,
      [key]: { ...prev, visited: true, marked, taken: [...prev.draft] },
    },
  };
}

export function saveAndAdvance(exam: Exam, attempt: Attempt, key: string, marked: boolean): Attempt {
  const committed = commitCurrent(exam, attempt, key, marked);
  if (committed === attempt) return attempt;
  const next = neighborKey(exam, key, 1);
  return next ? moveTo(exam, committed, next) : committed;
}

export function clearResponse(exam: Exam, attempt: Attempt, key: string): Attempt {
  if (attempt.closed || attempt.timeUp) return attempt;
  const item = findFlat(exam, key);
  if (!item || subjectIsLocked(exam, attempt, item.subjectId)) return attempt;
  const prev = attempt.questions[key] ?? emptyState();
  return {
    ...attempt,
    questions: {
      ...attempt.questions,
      [key]: { ...prev, visited: true, draft: [], taken: [] },
    },
  };
}

export function go(exam: Exam, attempt: Attempt, key: string, dir: -1 | 1): Attempt {
  const next = neighborKey(exam, key, dir);
  if (!next) return attempt;
  return moveTo(exam, attempt, next);
}

export function switchSubject(exam: Exam, attempt: Attempt, subjectId: string, now: number): Attempt {
  if (attempt.closed) return attempt;
  let next = tickAttempt(exam, attempt, now);
  if (next.closed) return next;
  if (exam.timerMode === "perSubject" && next.activeSubjectId && next.activeSubjectId !== subjectId) {
    const previousId = next.activeSubjectId;
    const remain =
      next.activeDeadline !== null
        ? Math.max(0, next.activeDeadline - now)
        : Math.max(0, next.subjectRemainingMs[previousId] ?? 0);
    let locked = next.lockedSubjects;
    if (remain <= 0 && !locked.includes(previousId)) locked = [...locked, previousId];
    const subjectRemainingMs = { ...next.subjectRemainingMs, [previousId]: remain };
    const newRemain = subjectRemainingMs[subjectId] ?? 0;
    next = {
      ...next,
      lockedSubjects: locked,
      subjectRemainingMs,
      activeSubjectId: subjectId,
      activeDeadline: newRemain > 0 && !locked.includes(subjectId) ? now + newRemain : null,
    };
    if (newRemain <= 0) next = lockSubject(exam, next, subjectId, now);
  }
  if (next.closed) return next;
  const key = next.lastKeyBySubject[subjectId] ?? firstKeyOfSubject(exam, subjectId);
  return key ? moveTo(exam, next, key) : next;
}

export function answersFromAttempt(attempt: Attempt): Record<string, string[] | null> {
  const answers: Record<string, string[] | null> = {};
  for (const [key, state] of Object.entries(attempt.questions)) answers[key] = state.taken;
  return answers;
}
