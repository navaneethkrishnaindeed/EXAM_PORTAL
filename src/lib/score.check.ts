import { answersFromAttempt, createAttempt, saveAndAdvance, setDraft, switchSubject, tickAttempt } from "./attempt";
import { mockResultSitting } from "./mockResult";
import { parseExam } from "./parse";
import { scoreExam, scoreQuestion } from "./score";
import { sampleExam } from "./sample";
import raw from "../data/sample-exam.json";
import type { Question, Section } from "../types/exam";

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

const section: Section = {
  id: "s",
  name: "S",
  marks: { correct: 4, negative: 1 },
  questions: [],
};

const single: Question = {
  id: "q",
  type: "single",
  prompt: "Pick",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  correct: ["b"],
};

assert(scoreQuestion(section, single, ["b"]).awarded === 4, "single correct");
assert(scoreQuestion(section, single, ["a"]).awarded === 0, "single wrong scores 0");
assert(scoreQuestion(section, single, null).awarded === 0, "single blank");
assert(scoreQuestion(section, single, []).outcome === "unanswered", "empty taken");

const multi: Question = {
  id: "m",
  type: "multi",
  prompt: "Pick",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
    { id: "c", text: "C" },
  ],
  correct: ["a", "c"],
};

assert(scoreQuestion(section, multi, ["a", "c"]).awarded === 4, "multi exact");
assert(scoreQuestion(section, multi, ["c", "a"]).awarded === 4, "multi order");
assert(scoreQuestion(section, multi, ["a"]).awarded === 0, "multi partial set scores 0");

const partial: Question = {
  ...multi,
  marks: { correct: 2, negative: 0, partialPerCorrect: 1 },
};
assert(scoreQuestion(section, partial, ["a", "c"]).awarded === 2, "partial full");
assert(scoreQuestion(section, partial, ["a"]).awarded === 1, "partial one");
assert(scoreQuestion(section, partial, ["a", "b"]).awarded === 1, "wrong option adds nothing");
assert(scoreQuestion(section, partial, ["b"]).awarded === 0, "partial wrong only scores 0");
assert(scoreQuestion(section, partial, null).awarded === 0, "partial blank");

const text: Question = {
  id: "t",
  type: "text",
  prompt: "Type",
  correct: ["Fe"],
  textMatch: "caseInsensitive",
};
const numeric: Question = {
  id: "n",
  type: "text",
  prompt: "Num",
  correct: ["3.14"],
  textMatch: "numericTolerance",
  tolerance: 0.001,
};
assert(scoreQuestion(section, text, ["fe"]).outcome === "correct", "case fold");
assert(scoreQuestion(section, text, ["iron"]).outcome === "incorrect", "case miss");
assert(scoreQuestion(section, numeric, ["3.140"]).outcome === "correct", "tolerance hit");
assert(scoreQuestion(section, numeric, ["3.15"]).outcome === "incorrect", "tolerance miss");

const exact: Question = { ...text, textMatch: "exact", correct: ["Fe"] };
assert(scoreQuestion(section, exact, ["fe"]).outcome === "incorrect", "exact case");
assert(scoreQuestion(section, exact, [" Fe "]).outcome === "correct", "trim");

let attempt = createAttempt(sampleExam, 1_000);
const first = attempt.currentKey;
attempt = setDraft(sampleExam, attempt, first, ["c"]);
assert(attempt.questions[first].taken === null, "onSave keeps draft uncommitted");
attempt = saveAndAdvance(sampleExam, attempt, first, false);
assert(attempt.questions[first].taken?.[0] === "c", "save commits");
const report = scoreExam(sampleExam, { [first]: attempt.questions[first].taken });
const line = report.lines.find((item) => item.key === first);
assert(line?.awarded === 1, "sample diamond is +1");
assert(line?.max === 1, "sample diamond max");

const selectExam = structuredClone(sampleExam);
selectExam.intake = "onSelect";
let live = createAttempt(selectExam, 1);
live = setDraft(selectExam, live, live.currentKey, ["c"]);
assert(live.questions[live.currentKey].taken?.[0] === "c", "onSelect commits immediately");

const perSubject = structuredClone(sampleExam);
perSubject.timerMode = "perSubject";
perSubject.autoSubmit = true;
perSubject.subjects[0].durationMinutes = 0.05;
perSubject.subjects[1].durationMinutes = 0.05;
let timed = createAttempt(perSubject, 10_000);
timed = tickAttempt(perSubject, timed, 13_000);
assert(timed.lockedSubjects.includes("phy"), "subject timer locks physics");
assert(!timed.closed, "other subject still open");
timed = switchSubject(perSubject, timed, "chem", 13_000);
assert(timed.activeSubjectId === "chem" && !timed.closed, "chemistry timer starts");
timed = tickAttempt(perSubject, timed, 16_000);
assert(timed.closed && timed.autoClosed, "paper closes when every subject timer ends");

const whole = structuredClone(sampleExam);
whole.durationMinutes = 1 / 60;
whole.timerMode = "exam";
whole.autoSubmit = true;
let paper = createAttempt(whole, 5_000);
paper = tickAttempt(whole, paper, 6_000);
assert(paper.closed && paper.autoClosed, "exam timer auto-closes");

whole.autoSubmit = false;
let held = createAttempt(whole, 5_000);
held = tickAttempt(whole, held, 6_000);
assert(!held.closed && held.timeUp, "timer can freeze until submit");

const lens = sampleExam.subjects[0]?.groups[0]?.sections[0]?.questions.find((item) => item.id === "q11");
assert(lens?.images?.length === 2, "sample question has two figures");

const loose = structuredClone(raw) as {
  subjects: { groups: { sections: { questions: { id: string; images?: unknown }[] }[] }[] }[];
};
const target = loose.subjects[0]?.groups[0]?.sections[0]?.questions.find((item) => item.id === "q11");
if (!target) throw new Error("lens question missing");
target.images = ["https://example.com/ray.png", { src: "  ", alt: "blank" }, { src: "https://example.com/b.png", alt: " Second " }];
const parsedImages = parseExam(loose);
const parsedLens = parsedImages.exam?.subjects[0]?.groups[0]?.sections[0]?.questions.find((item) => item.id === "q11");
assert(parsedLens?.images?.length === 2, "empty image entries are dropped");
assert(parsedLens?.images?.[0]?.src === "https://example.com/ray.png", "string image list");
assert(parsedLens?.images?.[1]?.alt === "Second", "image caption is trimmed");

const mock = mockResultSitting(sampleExam, 1_000_000);
const mockReport = scoreExam(sampleExam, answersFromAttempt(mock.attempt));
assert(mockReport.lines.every((line) => line.awarded >= 0), "mock result has no negative marks");
assert(mockReport.total === 9, `mock result total is ${mockReport.total}`);
assert(mockReport.max === 34, `mock result maximum is ${mockReport.max}`);

console.log("score checks passed");
