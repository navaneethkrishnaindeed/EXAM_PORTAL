import { useCallback, useEffect, useState } from "react";
import { createAttempt } from "./lib/attempt";
import { mockResultSitting } from "./lib/mockResult";
import { sampleExam } from "./lib/sample";
import { loadPapers, loadSitting, savePapers, saveSitting } from "./lib/storage";
import { Player } from "./player/Player";
import { Scorecard } from "./results/Scorecard";
import { Studio } from "./studio/Studio";
import type { Attempt, Exam, Sitting } from "./types/exam";

export function App() {
  const [papers, setPapers] = useState<Exam[]>(() => loadPapers());
  const [sitting, setSitting] = useState<Sitting | null>(() => loadSitting());
  const [view, setView] = useState<"studio" | "player">(() => (loadSitting() ? "player" : "studio"));

  useEffect(() => {
    saveSitting(sitting);
  }, [sitting]);

  useEffect(() => {
    savePapers(papers);
  }, [papers]);

  const updateAttempt = useCallback((attempt: Attempt) => {
    setSitting((prev) => (prev ? { exam: prev.exam, attempt } : prev));
  }, []);

  function showSampleResult() {
    setSitting(mockResultSitting(sampleExam));
    setView("player");
  }

  function start(exam: Exam) {
    const snapshot = structuredClone(exam);
    setSitting({ exam: snapshot, attempt: createAttempt(snapshot) });
    setView("player");
  }

  function discard() {
    setSitting(null);
    setView("studio");
  }

  if (sitting && view === "player") {
    if (sitting.attempt.closed) {
      return (
        <Scorecard
          exam={sitting.exam}
          attempt={sitting.attempt}
          onBack={() => setView("studio")}
          onRetake={() => start(sitting.exam)}
        />
      );
    }
    return (
      <Player
        exam={sitting.exam}
        attempt={sitting.attempt}
        onChange={updateAttempt}
        onExit={() => setView("studio")}
        onDiscard={discard}
      />
    );
  }

  return (
    <Studio
      papers={papers}
      setPapers={setPapers}
      sitting={sitting}
      onStart={start}
      onSampleResult={showSampleResult}
      onResume={() => setView("player")}
      onDiscard={discard}
    />
  );
}
