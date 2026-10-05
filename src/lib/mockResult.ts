import mockResult from "../data/mock-result.json";
import type { Exam, QuestionState, Sitting } from "../types/exam";
import { createAttempt } from "./attempt";
import { questionKey } from "./flatten";

interface MockAnswer {
  subjectId: string;
  groupId: string;
  sectionId: string;
  questionId: string;
  answer: string[];
}

export function mockResultSitting(exam: Exam, now = Date.now()): Sitting {
  const startedAt = now - 12 * 60 * 1000;
  const attempt = createAttempt(exam, startedAt);
  const questions: Record<string, QuestionState> = { ...attempt.questions };
  for (const item of mockResult.answers as MockAnswer[]) {
    const key = questionKey(item.subjectId, item.groupId, item.sectionId, item.questionId);
    if (!questions[key]) continue;
    questions[key] = {
      visited: true,
      marked: false,
      taken: [...item.answer],
      draft: [...item.answer],
    };
  }
  return {
    exam: structuredClone(exam),
    attempt: {
      ...attempt,
      questions,
      closed: true,
      autoClosed: false,
      timeUp: true,
      endedAt: startedAt + 12 * 60 * 1000,
    },
  };
}
