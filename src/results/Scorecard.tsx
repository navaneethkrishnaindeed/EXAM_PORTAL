import { QuestionImages } from "../components/QuestionImages";
import { answersFromAttempt } from "../lib/attempt";
import { formatClock, formatDuration, formatMarks, formatSigned } from "../lib/format";
import { scoreExam } from "../lib/score";
import type { Attempt, Exam, Marks } from "../types/exam";

interface ScorecardProps {
  exam: Exam;
  attempt: Attempt;
  onBack: () => void;
  onRetake: () => void;
}

const TYPE_LABEL = { single: "Radio", multi: "Multi select", text: "Text" };

function schemeLine(marks: Marks): string {
  const partial = marks.partialPerCorrect;
  if (partial && partial > 0) {
    return `+${formatMarks(partial)} per correct option. Wrong options score 0.`;
  }
  return `+${formatMarks(marks.correct)} if right, 0 if wrong or unanswered`;
}

export function Scorecard({ exam, attempt, onBack, onRetake }: ScorecardProps) {
  const report = scoreExam(exam, answersFromAttempt(attempt));
  const used = (attempt.endedAt ?? Date.now()) - attempt.startedAt;
  const percent = report.max > 0 ? Math.round((report.total / report.max) * 1000) / 10 : null;
  const policies = new Set(flattenIntakes(exam));

  return (
    <div className="score">
      <div className="score-wrap">
        <header className="score-head">
          <div>
            <p className="eyebrow">Mock result</p>
            <h1>{exam.title}</h1>
            <p className="muted">
              {attempt.autoClosed ? "Time ran out and the paper closed on its own." : "You submitted this paper."}
              {" "}Time used {formatDuration(used)}
              {exam.timerMode === "exam" ? ` of ${formatClock(exam.durationMinutes * 60 * 1000)}.` : "."}
            </p>
          </div>
          <div className="score-total" data-testid="score-total">
            <strong>{formatSigned(report.total)}</strong>
            <span>out of {formatMarks(report.max)}</span>
            <em>{percent === null ? "—" : `${percent}%`}</em>
          </div>
        </header>

        <section className="scheme-box">
          <h2>Marking scheme</h2>
          <p>
            There is no negative marking. A correct answer scores its marks. A wrong answer scores 0. An unanswered question scores 0.
            Multi-select is all-or-nothing unless the question sets a mark per correct option.
          </p>
          <ul>
            {exam.subjects.flatMap((subject) =>
              subject.groups.flatMap((group) =>
                group.sections.map((section) => (
                  <li key={`${subject.id}-${group.id}-${section.id}`}>
                    <strong>
                      {subject.name} / {group.name} / {section.name}:
                    </strong>{" "}
                    {schemeLine(section.marks)}
                  </li>
                )),
              ),
            )}
          </ul>
          <p className="muted">
            {policies.has("onSave") && policies.has("onSelect")
              ? "Some questions store on save and some store as soon as you answer. Unsaved drafts score as unanswered."
              : policies.has("onSave")
                ? "Answers count only after Save & Next or Mark for Review & Next. Drafts left unsaved score as unanswered."
                : "Answers were stored as soon as they were chosen or typed."}
          </p>
        </section>

        <div className="subject-scores">
          {report.bySubject.map((subject) => (
            <article key={subject.id}>
              <h3>{subject.name}</h3>
              <p>
                {formatSigned(subject.awarded)} <span>/ {formatMarks(subject.max)}</span>
              </p>
            </article>
          ))}
        </div>

        <div className="table-wrap">
          <table className="mark-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Type</th>
                <th>Question</th>
                <th>Your answer</th>
                <th>Key</th>
                <th>Scheme</th>
                <th>Marks</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => (
                <tr key={line.key} className={line.outcome}>
                  <td>{line.number}</td>
                  <td>{line.subjectName}</td>
                  <td>{line.sectionName}</td>
                  <td>{TYPE_LABEL[line.type]}</td>
                  <td className="prompt-cell" title={line.prompt}>
                    {line.prompt}
                    <QuestionImages images={line.images} compact />
                  </td>
                  <td>{line.yours}</td>
                  <td>{line.keyText}</td>
                  <td className="scheme-cell">{line.scheme}</td>
                  <td className={line.awarded < 0 ? "neg" : line.awarded > 0 ? "pos" : ""}>
                    {formatSigned(line.awarded)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="score-actions">
          <button type="button" className="act" onClick={onBack}>Back to studio</button>
          <button type="button" className="act save" onClick={onRetake}>Retake</button>
        </div>
      </div>
    </div>
  );
}

function flattenIntakes(exam: Exam): string[] {
  const policies: string[] = [];
  for (const subject of exam.subjects) {
    for (const group of subject.groups) {
      for (const section of group.sections) {
        for (const question of section.questions) policies.push(question.intake ?? exam.intake);
      }
    }
  }
  return policies;
}
