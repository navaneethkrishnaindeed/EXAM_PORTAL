import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearResponse,
  countStatuses,
  go,
  moveTo,
  remainingMs,
  saveAndAdvance,
  setDraft,
  statusOf,
  subjectIsLocked,
  switchSubject,
  tickAttempt,
} from "../lib/attempt";
import { flatten, neighborKey, sectionQuestions } from "../lib/flatten";
import { formatClock, formatMarks } from "../lib/format";
import { QuestionImages } from "../components/QuestionImages";
import { displayMarks } from "../lib/score";
import type { ActionId, Attempt, Exam, PaletteStatus } from "../types/exam";

interface PlayerProps {
  exam: Exam;
  attempt: Attempt;
  onChange: (attempt: Attempt) => void;
  onExit: () => void;
  onDiscard: () => void;
}

type ModalName = "paper" | "instructions" | "data" | "submit" | "profile" | "exit";

const STATUS_LABEL: Record<PaletteStatus, string> = {
  answered: "Answered",
  notAnswered: "Not Answered",
  notVisited: "Not Visited",
  marked: "Marked for Review",
  answeredMarked: "Answered & Marked for Review",
};

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function Player({ exam, attempt, onChange, onExit, onDiscard }: PlayerProps) {
  const now = useNow(!attempt.closed);
  const [modal, setModal] = useState<ModalName | null>(null);
  const [scale, setScale] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = tickAttempt(exam, attempt, Date.now());
    if (next !== attempt) onChange(next);
  }, [now, exam, attempt, onChange]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const flat = useMemo(() => flatten(exam), [exam]);
  const current = flat.find((item) => item.key === attempt.currentKey) ?? flat[0];

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [current?.key]);

  if (!current) {
    return (
      <div className="player">
        <p className="empty-paper">This paper has no questions.</p>
        <button type="button" onClick={onExit}>Back to studio</button>
      </div>
    );
  }

  const state = attempt.questions[current.key];
  const draft = state?.draft ?? [];
  const frozen = attempt.timeUp || subjectIsLocked(exam, attempt, current.subjectId);
  const marks = displayMarks(current.section, current.question);
  const remain = remainingMs(exam, attempt, now);
  const intake = current.question.intake ?? exam.intake;
  const inSection = sectionQuestions(exam, current.subjectId, current.groupId, current.sectionId);
  const legend = countStatuses(inSection.map((item) => attempt.questions[item.key]));
  const paperCounts = countStatuses(flat.map((item) => attempt.questions[item.key]));
  const subject = exam.subjects.find((item) => item.id === current.subjectId);
  const group = subject?.groups.find((item) => item.id === current.groupId);
  const has = (action: ActionId) => exam.actions.includes(action);

  function changeDraft(next: string[]) {
    onChange(setDraft(exam, attempt, current.key, next));
  }

  function toggleMulti(id: string) {
    const next = draft.includes(id) ? draft.filter((item) => item !== id) : [...draft, id];
    changeDraft(next);
  }

  return (
    <div className="player">
      <header className="topbar">
        <div className="subject-tabs">
          <button type="button" className="exit-link" onClick={() => setModal("exit")}>
            Exit
          </button>
          {exam.subjects.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === current.subjectId ? "subject-tab active" : "subject-tab"}
              onClick={() => onChange(switchSubject(exam, attempt, item.id, Date.now()))}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="tool-row">
          <button type="button" className="tool" onClick={() => setModal("paper")}>
            <i className="dot green" /> Question Paper
          </button>
          <button type="button" className="tool" onClick={() => setModal("instructions")}>
            <i className="dot blue" /> Instructions
          </button>
          <button type="button" className="tool" onClick={() => setModal("data")}>
            <i className="dot orange" /> Useful Data
          </button>
          <button type="button" className="tool" onClick={() => setScale((value) => Math.max(0.85, value - 0.1))} aria-label="Smaller text">
            A−
          </button>
          <button type="button" className="tool" onClick={() => setScale((value) => Math.min(1.45, value + 0.1))} aria-label="Larger text">
            A+
          </button>
        </div>
      </header>

      <div className="groupbar">
        {subject?.groups.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === current.groupId ? "group-tab active" : "group-tab"}
            onClick={() => {
              if (item.id === current.groupId) return;
              const first = flat.find((q) => q.subjectId === current.subjectId && q.groupId === item.id);
              if (first) onChange(moveTo(exam, attempt, first.key));
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="sectionbar">
        <div className="section-tabs">
          <span className="section-label">Section</span>
          {group?.sections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === current.sectionId ? "section-tab active" : "section-tab"}
              title={`${item.questions.length} questions · +${formatMarks(item.marks.correct)} if right, 0 if wrong`}
              onClick={() => {
                if (item.id === current.sectionId) return;
                const first = flat.find(
                  (q) => q.subjectId === current.subjectId && q.groupId === current.groupId && q.sectionId === item.id,
                );
                if (first) onChange(moveTo(exam, attempt, first.key));
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="section-side">
          <div className="time" data-testid="time-left">
            <span>Time Left :</span>
            <strong className={remain < 60_000 ? "low" : ""}>{formatClock(remain)}</strong>
            {exam.timerMode === "perSubject" && <em>{current.subjectName}</em>}
          </div>
          <button type="button" className="profile" onClick={() => setModal("profile")}>
            <span className="barcode" aria-hidden="true" />
            <span>
              <b>{exam.candidateName}</b>
              <small>Profile</small>
            </span>
          </button>
        </div>
      </div>

      {attempt.timeUp && (
        <div className="banner">Time is up. Submit the paper to open the marks.</div>
      )}
      {!attempt.timeUp && subjectIsLocked(exam, attempt, current.subjectId) && (
        <div className="banner">
          Time is up for {current.subjectName}. Saved answers stay. Other subjects remain open.
        </div>
      )}

      <div className="marksrow">
        <div className="marksline">
          <span>
            Marks for correct answer <strong>{formatMarks(marks.correct)}</strong>
          </span>
          <span className="sep">|</span>
          <span>
            Negative Marks <strong>{formatMarks(marks.negative)}</strong>
          </span>
          {marks.note && <span className="scheme-note">{marks.note}</span>}
        </div>
        <Legend counts={legend} />
      </div>

      <div className="workspace">
        <div className="paper-col">
          <div className="bluebar" />
          <div className="qscroll" ref={scroller}>
            <article className="qcard" style={{ fontSize: `${scale}rem` }}>
              <h2>Question No:{current.number}</h2>
              <p className="prompt" data-testid="prompt">{current.question.prompt}</p>
              <QuestionImages images={current.question.images} />
              {current.question.type === "text" ? (
                <label className="text-answer">
                  Your answer
                  <input
                    type="text"
                    value={draft[0] ?? ""}
                    disabled={frozen}
                    autoComplete="off"
                    data-testid="text-answer"
                    onChange={(event) => changeDraft([event.target.value])}
                  />
                </label>
              ) : (
                <div className="choices">
                  {(current.question.options ?? []).map((option) => (
                    <label key={option.id} className="choice">
                      <input
                        type={current.question.type === "multi" ? "checkbox" : "radio"}
                        name={current.key}
                        checked={draft.includes(option.id)}
                        disabled={frozen}
                        onChange={() => {
                          if (current.question.type === "multi") toggleMulti(option.id);
                          else changeDraft([option.id]);
                        }}
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
              )}
              {(statusOf(state) === "marked" || statusOf(state) === "answeredMarked") && (
                <p className="review-flag">Marked for review</p>
              )}
              <p className="intake-hint">
                {intake === "onSave"
                  ? "This answer is stored when you press Save & Next or Mark for Review & Next."
                  : "This answer is stored as soon as you choose or type it."}
              </p>
              {note && <p className="end-note">{note}</p>}
              <div className="actions">
                {has("saveNext") && (
                  <button
                    type="button"
                    className="act save"
                    data-testid="save-next"
                    disabled={frozen}
                    onClick={() => {
                      const before = current.key;
                      const next = saveAndAdvance(exam, attempt, current.key, false);
                      setNote(next.currentKey === before ? "Saved. This is the last question." : null);
                      onChange(next);
                    }}
                  >
                    Save & Next
                  </button>
                )}
                {has("markReviewNext") && (
                  <button
                    type="button"
                    className="act review"
                    disabled={frozen}
                    onClick={() => {
                      const before = current.key;
                      const next = saveAndAdvance(exam, attempt, current.key, true);
                      setNote(next.currentKey === before ? "Saved and marked. This is the last question." : null);
                      onChange(next);
                    }}
                  >
                    Mark for Review & Next
                  </button>
                )}
                {has("clear") && (
                  <button
                    type="button"
                    className="act"
                    disabled={frozen}
                    onClick={() => {
                      setNote(null);
                      onChange(clearResponse(exam, attempt, current.key));
                    }}
                  >
                    Clear Response
                  </button>
                )}
                {has("previous") && (
                  <button
                    type="button"
                    className="act"
                    disabled={!neighborKey(exam, current.key, -1)}
                    onClick={() => {
                      setNote(null);
                      onChange(go(exam, attempt, current.key, -1));
                    }}
                  >
                    &laquo; Previous
                  </button>
                )}
                <button
                  type="button"
                  className="act"
                  disabled={!neighborKey(exam, current.key, 1)}
                  onClick={() => {
                    setNote(null);
                    onChange(go(exam, attempt, current.key, 1));
                  }}
                >
                  Next &raquo;
                </button>
                {has("submit") && (
                  <button type="button" className="act submit" data-testid="submit-open" onClick={() => setModal("submit")}>
                    Submit
                  </button>
                )}
              </div>
            </article>
          </div>
        </div>
        <aside className="palette">
          <div className="palette-head">{current.sectionName}</div>
          <div className="choose">Choose a Question</div>
          <div className="qgrid">
            {inSection.map((item) => {
              const status = statusOf(attempt.questions[item.key]);
              const isCurrent = item.key === current.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-testid="palette-btn"
                  data-q={item.key}
                  className={`qbtn ${status}${isCurrent ? " current" : ""}`}
                  onClick={() => {
                    setNote(null);
                    onChange(moveTo(exam, attempt, item.key));
                  }}
                >
                  {item.number}
                  {status === "answeredMarked" && <i className="mini-dot" />}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {modal === "paper" && (
        <Modal title="Question Paper" onClose={() => setModal(null)}>
          {exam.subjects.map((item) => (
            <section key={item.id} className="paper-block">
              <h3>{item.name}</h3>
              {item.groups.map((g) =>
                g.sections.map((section) => (
                  <div key={`${g.id}-${section.id}`}>
                    <h4>
                      {g.name} · {section.name}
                    </h4>
                    <ol>
                      {section.questions.map((question) => (
                        <li key={question.id}>
                          <p>{question.prompt}</p>
                          <QuestionImages images={question.images} />
                          {question.type !== "text" && (
                            <ul>
                              {(question.options ?? []).map((option) => (
                                <li key={option.id}>{option.text}</li>
                              ))}
                            </ul>
                          )}
                          {question.type === "text" && <p className="muted">Text answer</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )),
              )}
            </section>
          ))}
        </Modal>
      )}
      {modal === "instructions" && (
        <Modal title="Instructions" onClose={() => setModal(null)}>
          <pre className="plain">{exam.instructions || "No instructions on this paper."}</pre>
        </Modal>
      )}
      {modal === "data" && (
        <Modal title="Useful Data" onClose={() => setModal(null)}>
          <pre className="plain">{exam.usefulData || "No useful data on this paper."}</pre>
        </Modal>
      )}
      {modal === "profile" && (
        <Modal title="Profile" onClose={() => setModal(null)}>
          <p><strong>{exam.candidateName}</strong></p>
          <p>{exam.title}</p>
          <p className="muted">Personal mock. Answers stay in this browser.</p>
        </Modal>
      )}
      {modal === "submit" && (
        <Modal title="Submit this paper?" onClose={() => setModal(null)}>
          <p>Stored answers will be marked. Unsaved drafts are not included.</p>
          <ul className="count-list">
            <li>Answered: {paperCounts.answered + paperCounts.answeredMarked}</li>
            <li>Not answered: {paperCounts.notAnswered}</li>
            <li>Not visited: {paperCounts.notVisited}</li>
            <li>Marked for review: {paperCounts.marked + paperCounts.answeredMarked}</li>
          </ul>
          <div className="modal-actions">
            <button type="button" className="act" onClick={() => setModal(null)}>Go back</button>
            <button
              type="button"
              className="act submit"
              data-testid="submit-confirm"
              onClick={() => onChange({ ...attempt, closed: true, autoClosed: false, timeUp: true, endedAt: Date.now() })}
            >
              Submit
            </button>
          </div>
        </Modal>
      )}
      {modal === "exit" && (
        <Modal title="Leave this test?" onClose={() => setModal(null)}>
          <p>Your answers stay on this browser until you resume, submit, or discard the test.</p>
          <div className="modal-actions">
            <button type="button" className="act" onClick={() => setModal(null)}>Cancel</button>
            <button type="button" className="act" onClick={onDiscard}>Discard</button>
            <button type="button" className="act save" onClick={onExit}>Resume later</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Legend({ counts }: { counts: Record<PaletteStatus, number> }) {
  const items: PaletteStatus[] = ["answered", "notAnswered", "notVisited", "marked", "answeredMarked"];
  return (
    <div className="legend" aria-label="Question status">
      {items.map((status) => (
        <div key={status} className="legend-item">
          <span className={`swatch ${status}`}>{counts[status]}</span>
          <span>{STATUS_LABEL[status]}</span>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
