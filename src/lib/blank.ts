import type { Exam, Group, Question, QuestionType, Section, Subject } from "../types/exam";
import { ALL_ACTIONS } from "../types/exam";
import { uid } from "./format";

export function blankQuestion(type: QuestionType = "single"): Question {
  if (type === "text") {
    return {
      id: uid("q"),
      type,
      prompt: "",
      correct: [""],
      textMatch: "exact",
      tolerance: 0,
    };
  }
  return {
    id: uid("q"),
    type,
    prompt: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correct: type === "single" ? ["a"] : [],
  };
}

export function blankSection(name = "Section1"): Section {
  return {
    id: uid("sec"),
    name,
    marks: { correct: 1, negative: 0 },
    questions: [blankQuestion("single")],
  };
}

export function blankGroup(name = "Group 1"): Group {
  return {
    id: uid("grp"),
    name,
    sections: [blankSection("Section1")],
  };
}

export function blankSubject(name = "Subject 1"): Subject {
  return {
    id: uid("sub"),
    name,
    durationMinutes: 15,
    groups: [blankGroup("Group 1")],
  };
}

export function blankExam(): Exam {
  return {
    id: uid("paper"),
    title: "Untitled paper",
    instructions:
      "Save & Next stores your answer. Mark for Review & Next stores it and flags the question. Clear Response removes the stored answer. The timer closes the paper when it reaches zero if auto-submit is on.",
    usefulData: "",
    durationMinutes: 30,
    timerMode: "exam",
    autoSubmit: true,
    actions: [...ALL_ACTIONS],
    intake: "onSave",
    candidateName: "Candidate",
    subjects: [blankSubject("Subject 1")],
  };
}

export function nextOptionId(ids: string[]): string {
  const used = new Set(ids);
  for (let i = 0; i < 26; i += 1) {
    const id = String.fromCharCode(97 + i);
    if (!used.has(id)) return id;
  }
  return uid("opt");
}
