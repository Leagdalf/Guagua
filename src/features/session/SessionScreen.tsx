import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getUnit } from "../../core/content";
import type { ChoiceTask, Feedback as TaskFeedback, PairsTask, RoundTask } from "../../core/tasks";
import { speakTextOf } from "../../core/tasks";
import type { Day, Item, Progress } from "../../core/types";
import {
  ActionBar,
  AnswerList,
  AnswerRow,
  AudioButton,
  CheckIcon,
  CrossIcon,
  Es,
  Feedback,
  Label,
  LessonPage,
  Marker,
  Mountain,
  PairsBoard,
  PrimaryButton,
  SentenceBuilder,
  SummaryList,
  TextButton,
  TextField,
  UnitHeader,
} from "../../ui";
import type { PairItem, PairState, StopState } from "../../ui";
import { counterOf, mountainBefore, mountainStops, stepNumberOf, summaryFacts, summaryText } from "./machine";
import type { CardsScreen, DialogueScreen, PlanScreen, SessionEvent, SessionState, TaskScreen } from "./machine";
import "./session.css";

// Die Ansicht zeigt nur an. Alles Tippen geht als Ereignis an die Maschine (`onEvent`), alles Sprechen über `onSpeak`.
// Beides rufen SessionView-Behandlungen auf, dort steht auch das einzige `speak(`.

export interface SessionScreenProps {
  state: SessionState;
  progress: Progress;
  day: Day;
  /** Gibt es eine spanische Stimme? Ohne sind die Tonknöpfe deaktiviert. */
  hasVoice: boolean;
  onEvent: (event: SessionEvent) => void;
  onSpeak: (text: string, slow?: boolean) => void;
  /** „Schließen“ im Kopf. */
  onClose: () => void;
  /** „Zur Linie“ nach der Zusammenfassung. */
  onExit: () => void;
}

const ROLE_LABEL = { review: "Wiederholen", extra: "Extra", final: "Abschlussrunde", cloze: "Grammatik" } as const;

const QUESTION_LABEL = {
  recognize: "Was heißt das?",
  listen: "Was hörst du?",
  recall: "Wie heißt das auf Spanisch?",
  cloze: "Welches Wort fehlt?",
  build: "Setze den Satz zusammen",
  write: "Schreib es auf Spanisch",
} as const;

/** Ab dieser Länge steht das Spanische kleiner, damit der Satz in wenige Zeilen passt. */
const LONG_PROMPT = 24;

function fillName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}

interface View {
  body: ReactNode;
  footer: ReactNode;
}

export function SessionScreen(props: SessionScreenProps) {
  const { state, progress, onClose } = props;
  // Text des Schreibens gehört zur Aufgabe: Mit jeder neuen Aufgabe (seq) beginnt er leer.
  const seq = state.screen.kind === "task" ? state.screen.seq : -1;
  const [typed, setTyped] = useState<{ seq: number; value: string }>({ seq: -1, value: "" });
  const text = typed.seq === seq ? typed.value : "";

  const step = stepNumberOf(state);
  const counter = counterOf(state) ?? undefined;
  const header =
    step !== null ? (
      <UnitHeader current={step} counter={counter} onClose={onClose} closeLabel="Schließen" />
    ) : (
      <div className="unit-header">
        <button type="button" className="unit-header__close" aria-label="Schließen" onClick={onClose}>
          <CrossIcon />
        </button>
        {counter && <p className="unit-header__counter sx-counter-end">{counter}</p>}
      </div>
    );

  const name = progress.profile.name;
  const view = renderScreen(props, (t) => fillName(t, name), text, (value) => setTyped({ seq, value }));
  return (
    <LessonPage header={header} footer={view.footer ? <ActionBar>{view.footer}</ActionBar> : undefined}>
      {view.body}
    </LessonPage>
  );
}

function renderScreen(props: SessionScreenProps, fill: (text: string) => string, text: string, setText: (value: string) => void): View {
  const { state } = props;
  const screen = state.screen;
  switch (screen.kind) {
    case "plan":
      return plan(props, screen);
    case "cards":
      return screen.stage === "look" ? cardLook(props, screen) : cardPairs(props, screen);
    case "grammar":
      return grammar(props);
    case "task":
      return taskView(props, screen, text, setText);
    case "dialogue":
      return dialogue(props, screen, fill);
    case "mission":
      return mission(props, fill);
    case "summary":
      return summary(props);
  }
}

// ---------- Fahrplan ----------

function plan(props: SessionScreenProps, screen: PlanScreen): View {
  return {
    body: (
      <div className="sx-body enter" key="plan">
        <Label as="h1">{screen.label}</Label>
        {screen.title.spanish ? (
          <Es as="p" size="today" className="sx-plan-title" id="sx-plan-title">
            <Marker>{screen.title.text}</Marker>
          </Es>
        ) : (
          <p className="sx-plan-title sx-plan-title--de">{screen.title.text}</p>
        )}
        <ul className="sx-plan" aria-label="Schritte">
          {screen.rows.map((row) => (
            <li key={row.name} className="sx-plan__row">
              <span className={row.done ? "sx-plan__box sx-plan__box--done" : "sx-plan__box"} aria-hidden="true">
                {row.done && <CheckIcon />}
              </span>
              <span className="sx-plan__name">
                {row.name}
                <span className="vh">{row.done ? ", erledigt" : ", offen"}</span>
              </span>
              <span className="sx-plan__detail">{row.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
    footer: <PrimaryButton onClick={() => props.onEvent({ type: "begin" })}>{screen.button}</PrimaryButton>,
  };
}

// ---------- Neue Karten ----------

function Audio({ props, text, describedBy }: { props: SessionScreenProps; text: string; describedBy?: string }) {
  return (
    <div className="sx-audio">
      <AudioButton onClick={() => props.onSpeak(text)} disabled={!props.hasVoice} describedBy={describedBy} />
      <AudioButton variant="slow" onClick={() => props.onSpeak(text, true)} disabled={!props.hasVoice} describedBy={describedBy} />
    </div>
  );
}

function cardLook(props: SessionScreenProps, screen: CardsScreen): View {
  const item: Item | undefined = screen.blocks[screen.block]?.items[screen.card];
  if (!item) return { body: null, footer: null };
  const frame = item.kind === "frame" && item.example;
  const long = item.es.length > LONG_PROMPT;
  return {
    body: (
      <div className="sx-body enter" key={item.id}>
        <Label as="h1">Neue Karten</Label>
        <Es as="p" size={long ? "inherit" : "card"} className={long ? "sx-prompt sx-prompt--long" : "sx-prompt"} id="sx-prompt">
          <Marker>{item.es}</Marker>
        </Es>
        <p className="sx-translation">{item.de}</p>
        {item.note_de && <p className="sx-note">{item.note_de}</p>}
        {frame && (
          <>
            <Es as="p" id="sx-example" className="sx-example">
              {item.example?.es}
            </Es>
            <p className="sx-example sx-example--de">{item.example?.de}</p>
          </>
        )}
        <Audio props={props} text={speakTextOf(item)} describedBy={frame ? "sx-example" : "sx-prompt"} />
      </div>
    ),
    footer: <PrimaryButton onClick={() => props.onEvent({ type: "next" })}>Weiter</PrimaryButton>,
  };
}

function cardPairs(props: SessionScreenProps, screen: CardsScreen): View {
  const block = screen.blocks[screen.block];
  if (!block) return { body: null, footer: null };
  const task: PairsTask = block.pairs;
  const run = screen.pairs;
  const text = (id: string, field: "es" | "de") => task.pairs.find((pair) => pair.itemId === id)?.[field] ?? "";
  const stateOf = (side: "left" | "right", id: string): PairState => {
    if (run.found.includes(id)) return "found";
    if (run.wrong && (side === "left" ? run.wrong.left : run.wrong.right) === id) return "wrong";
    if (run.selected && run.selected.side === side && run.selected.id === id) return "selected";
    return "selectable";
  };
  const left: PairItem[] = task.esOrder.map((id) => ({ id, text: text(id, "es"), state: stateOf("left", id) }));
  const right: PairItem[] = task.deOrder.map((id) => ({ id, text: text(id, "de"), state: stateOf("right", id) }));
  const done = run.found.length === block.items.length;
  return {
    body: (
      <div className="sx-body enter" key={`pairs-${screen.block}`}>
        <Label as="h1">Neue Karten · Ordne zu</Label>
        <p className="sx-note">Tippe ein spanisches Wort und das passende deutsche.</p>
        <PairsBoard className="sx-pairs" left={left} right={right} onSelect={(side, id) => props.onEvent({ type: "pair", side, id })} />
      </div>
    ),
    footer: (
      <PrimaryButton disabled={!done} onClick={() => props.onEvent({ type: "next" })}>
        Weiter
      </PrimaryButton>
    ),
  };
}

// ---------- Grammatik ----------

function grammar(props: SessionScreenProps): View {
  const unit = props.state.unitId === null ? undefined : getUnit(props.state.unitId);
  if (!unit) return { body: null, footer: null };
  const { topic_de, explanation_de, table, examples } = unit.grammar;
  return {
    body: (
      <div className="sx-body enter" key="grammar">
        <Label as="h1">Grammatik</Label>
        <p className="sx-prompt-de">{topic_de}</p>
        <p className="sx-explain">{explanation_de}</p>
        <ul className="sx-table" aria-label="Tabelle">
          {table.map((row) => (
            <li key={row.label_de} className="sx-table__row">
              <span className="sx-table__label">{row.label_de}</span>
              <Es>{row.es}</Es>
              <span>{row.de}</span>
            </li>
          ))}
        </ul>
        <Label as="h2" className="sx-section">
          Beispiele
        </Label>
        <ul className="sx-examples">
          {examples.map((example, i) => (
            <li key={example.es} className="sx-examples__row">
              <Es as="p" id={`sx-ex-${i}`}>
                {example.es}
              </Es>
              <p className="sx-examples__de">{example.de}</p>
              <Audio props={props} text={example.es} describedBy={`sx-ex-${i}`} />
            </li>
          ))}
        </ul>
      </div>
    ),
    footer: <PrimaryButton onClick={() => props.onEvent({ type: "next" })}>Weiter zu den Lückensätzen</PrimaryButton>,
  };
}

// ---------- Aufgaben ----------

/** Antworten stehen auf Spanisch bei „Erinnern“ und „Lücke“, sonst auf Deutsch. */
function answersAreSpanish(task: ChoiceTask): boolean {
  return task.type === "recall" || task.type === "cloze";
}

function taskView(props: SessionScreenProps, screen: TaskScreen, text: string, setText: (value: string) => void): View {
  const { task, answer } = screen;
  const label = [ROLE_LABEL[screen.role], screen.repeat ? "noch einmal" : null, QUESTION_LABEL[task.type]].filter(Boolean).join(" · ");
  const answered = answer !== null;
  const next = () => props.onEvent({ type: "next" });

  let footer: ReactNode = null;
  if (answered) footer = <PrimaryButton onClick={next}>Weiter</PrimaryButton>;
  else if (task.kind === "build") {
    footer = (
      <PrimaryButton disabled={screen.placed.length !== task.tokens.length} onClick={() => props.onEvent({ type: "check" })}>
        Prüfen
      </PrimaryButton>
    );
  } else if (task.kind === "write") {
    footer = (
      <PrimaryButton disabled={text.trim() === ""} onClick={() => props.onEvent({ type: "submitText", text })}>
        Prüfen
      </PrimaryButton>
    );
  }

  return {
    body: (
      <div className="sx-body enter" key={screen.seq}>
        <Label as="h1">{label}</Label>
        {task.kind === "choice" && <ChoiceBody props={props} screen={screen} task={task} />}
        {task.kind === "build" && <BuildBody props={props} screen={screen} task={task} />}
        {task.kind === "write" && (
          <>
            <p className="sx-prompt-de">{task.prompt}</p>
            <TextField className="sx-field" label="Spanisch" spanish value={text} onChange={setText} disabled={answered} />
          </>
        )}
        {answer && <AnswerFeedback props={props} task={task} answer={answer} />}
      </div>
    ),
    footer,
  };
}

function ChoiceBody({ props, screen, task }: { props: SessionScreenProps; screen: TaskScreen; task: ChoiceTask }) {
  const answered = screen.answer !== null;
  const spanish = answersAreSpanish(task);
  const frameExample = task.exampleHint;

  let prompt: ReactNode = null;
  if (task.type === "recognize" && task.prompt !== null) {
    const long = task.prompt.length > LONG_PROMPT;
    prompt = (
      <Es as="p" size={long ? "inherit" : "card"} className={long ? "sx-prompt sx-prompt--long" : "sx-prompt"} id="sx-prompt">
        <Marker>{task.prompt}</Marker>
      </Es>
    );
  } else if (task.type === "listen") {
    prompt = <p className="sx-instruction">Höre zu und wähle die deutsche Bedeutung.</p>;
  } else if (task.type === "recall" && task.prompt !== null) {
    prompt = <p className="sx-prompt-de">{task.prompt}</p>;
  } else if (task.type === "cloze" && task.prompt !== null) {
    prompt = (
      <>
        <Es as="p" size="inherit" className="sx-prompt sx-prompt--long" id="sx-prompt">
          <Marker>{task.prompt}</Marker>
        </Es>
        {task.hint && <p className="sx-note">{task.hint}</p>}
      </>
    );
  }

  const example =
    frameExample &&
    (frameExample.lang === "es" ? (
      <Es as="p" id="sx-example" className="sx-example">
        {frameExample.text}
      </Es>
    ) : (
      <p className="sx-example sx-example--de">{frameExample.text}</p>
    ));

  // Tonknöpfe vor der Antwort nur dort, wo der Ton nichts verrät: Erkennen und Hören.
  const showAudio = answered || task.type === "recognize" || task.type === "listen";
  let describedBy: string | undefined;
  if (task.type === "recognize") describedBy = frameExample && frameExample.lang === "es" ? "sx-example" : "sx-prompt";
  else if (answered) describedBy = "sx-heard";

  return (
    <>
      {prompt}
      {example}
      {showAudio && <Audio props={props} text={task.speak} describedBy={describedBy} />}
      {answered && task.type !== "recognize" && (
        <Es className="vh" id="sx-heard">
          {task.speak}
        </Es>
      )}
      <AnswerList className="sx-answers" label="Antworten">
        {task.options.map((option, index) => {
          let state: "selectable" | "correct" | "wrong" | "locked" = "selectable";
          if (answered) state = index === task.correctIndex ? "correct" : index === screen.chosen ? "wrong" : "locked";
          return (
            <AnswerRow key={index} state={state} onClick={() => props.onEvent({ type: "choose", index })}>
              {spanish ? <Es size="inherit">{option}</Es> : option}
            </AnswerRow>
          );
        })}
      </AnswerList>
    </>
  );
}

function BuildBody({ props, screen, task }: { props: SessionScreenProps; screen: TaskScreen; task: Extract<RoundTask, { kind: "build" }> }) {
  const answered = screen.answer !== null;
  const words = task.tokens.map((token, index) => ({ id: String(index), text: token }));
  return (
    <>
      <p className="sx-prompt-de">{task.prompt}</p>
      <SentenceBuilder
        className="sx-builder"
        words={words}
        placed={screen.placed.map(String)}
        onPlace={answered ? undefined : (id) => props.onEvent({ type: "place", index: Number(id) })}
        onRemove={answered ? undefined : (id) => props.onEvent({ type: "unplace", index: Number(id) })}
      />
    </>
  );
}

function AnswerFeedback({ props, task, answer }: { props: SessionScreenProps; task: RoundTask; answer: TaskFeedback }) {
  const result = answer.verdict === "accent" ? "accent" : answer.correct ? "correct" : "wrong";
  const spanishSolution = task.kind !== "choice" || answersAreSpanish(task);
  const solutionText = answer.verdict === "accent" && answer.accentHint ? answer.accentHint : answer.solution;
  // Bei Auswahlaufgaben zeigen die Zeilen die gewählte Antwort schon. Satzbau und Schreiben nennen sie hier.
  const showChosen = task.kind !== "choice" && !answer.correct && answer.chosen;
  const heard = task.kind === "choice" && task.type === "listen";
  const hint =
    showChosen || heard || answer.note || answer.example ? (
      <>
        {showChosen && (
          <span className="sx-line-note">
            Deine Antwort: <Es>{answer.chosen}</Es>
          </span>
        )}
        {heard && (
          <span className="sx-line-note">
            Gehört: <Es>{task.speak}</Es>
          </span>
        )}
        {answer.note && <span className="sx-line-note">{answer.note}</span>}
        {answer.example && (
          <span className="sx-line-note">
            Beispiel: <Es>{answer.example.es}</Es>, {answer.example.de}
          </span>
        )}
      </>
    ) : undefined;
  return (
    <>
      <Feedback result={result} solution={spanishSolution ? <Es>{solutionText}</Es> : solutionText} hint={hint} />
      {task.kind !== "choice" && <Audio props={props} text={task.speak} />}
    </>
  );
}

// ---------- Dialog ----------

function dialogue(props: SessionScreenProps, screen: DialogueScreen, fill: (text: string) => string): View {
  const unit = props.state.unitId === null ? undefined : getUnit(props.state.unitId);
  if (!unit) return { body: null, footer: null };
  const lines = unit.dialogue.lines;
  const last = screen.shown >= lines.length;
  return {
    body: (
      <div className="sx-body" key="dialogue">
        <Label as="h1">Dialog · anhören</Label>
        <p className="sx-note">{fill(unit.dialogue.setting_de)}</p>
        <ol className="sx-dialogue">
          {lines.slice(0, screen.shown).map((line, i) => {
            const newest = i === screen.shown - 1;
            const revealed = screen.revealed.includes(i);
            return (
              <li
                key={i}
                className={line.learner ? "sx-dialogue__line sx-dialogue__line--learner enter" : "sx-dialogue__line enter"}
                ref={newest ? scrollIntoViewWhenNew : undefined}
              >
                <Es as="p" className="sx-dialogue__speaker">
                  {line.speaker}
                </Es>
                <Es as="p" id={`sx-line-${i}`} className="sx-dialogue__said">
                  {newest ? <Marker>{fill(line.es)}</Marker> : fill(line.es)}
                </Es>
                <div className="sx-audio">
                  <AudioButton onClick={() => props.onSpeak(fill(line.es))} disabled={!props.hasVoice} describedBy={`sx-line-${i}`} />
                  {revealed ? (
                    <span>{fill(line.de)}</span>
                  ) : (
                    <TextButton onClick={() => props.onEvent({ type: "reveal", line: i })}>Übersetzung zeigen</TextButton>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    ),
    footer: <PrimaryButton onClick={() => props.onEvent({ type: "next" })}>{last ? "Zur Abschlussrunde" : "Weiter"}</PrimaryButton>,
  };
}

/** Die neueste Zeile rückt ins Bild, wenn sie erscheint (Ref-Funktion, kein Effekt, kein Ton). */
function scrollIntoViewWhenNew(element: HTMLLIElement | null): void {
  element?.scrollIntoView?.({ block: "nearest" });
}

// ---------- Mission ----------

function mission(props: SessionScreenProps, fill: (text: string) => string): View {
  const unit = props.state.unitId === null ? undefined : getUnit(props.state.unitId);
  if (!unit) return { body: null, footer: null };
  const { title_de, task_de, say } = unit.mission;
  return {
    body: (
      <div className="sx-body enter" key="mission">
        <Label as="h1">Mission</Label>
        <p className="sx-title">{title_de}</p>
        <p className="sx-explain">{task_de}</p>
        <Label as="h2" className="sx-section">
          Sätze zum Mitnehmen
        </Label>
        <ul className="sx-say">
          {say.map((sentence, i) => (
            <li key={sentence} className="sx-say__row">
              <Es as="span" id={`sx-say-${i}`}>
                {fill(sentence)}
              </Es>
              <AudioButton onClick={() => props.onSpeak(fill(sentence))} disabled={!props.hasVoice} describedBy={`sx-say-${i}`} />
            </li>
          ))}
        </ul>
        <Label as="h2" className="sx-section">
          Kanaren
        </Label>
        <p className="sx-explain">{unit.canarias_de}</p>
      </div>
    ),
    footer: <PrimaryButton onClick={() => props.onEvent({ type: "next" })}>Weiter</PrimaryButton>,
  };
}

// ---------- Zusammenfassung ----------

/** Wirkt `prefers-reduced-motion: reduce`? Ohne Browser (Server-Render, Tests) zählt es als ja: Dann steht gleich der neue Stand. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Berg der Zusammenfassung. Mit Bewegung erscheint er mit dem alten Stand und wechselt nach dem Einblenden auf den neuen
 * (die Bausteine blenden die Füllung in 600 ms über). Im Ruhemodus und bei `prefers-reduced-motion` steht gleich der neue.
 * Reiner Zustandswechsel im Effekt, ohne Ton.
 */
function SummaryMountain({ before, after, animate }: { before: readonly StopState[]; after: readonly StopState[]; animate: boolean }) {
  const [reached, setReached] = useState(false);
  const key = after.join(",");
  useEffect(() => {
    if (!animate) return;
    const timer = window.setTimeout(() => setReached(true), 80);
    return () => window.clearTimeout(timer);
  }, [animate, key]);
  return <Mountain stops={animate && !reached ? before : after} />;
}

function summary(props: SessionScreenProps): View {
  const { state, progress, day } = props;
  const facts = summaryFacts(state, progress, day);
  const unit = state.unitId === null ? undefined : getUnit(state.unitId);
  const after = mountainStops(progress);
  const text = summaryText(facts, {
    calm: progress.profile.calm,
    missionTitle: unit ? unit.mission.title_de : null,
    doneStops: after.filter((stop) => stop === "done").length,
  });
  const animate = facts.kind === "unit" && !progress.profile.calm && !prefersReducedMotion();

  return {
    body: (
      <div className="sx-body enter" key="summary">
        {facts.kind === "unit" && (
          <div className="sx-mountain">
            <SummaryMountain before={mountainBefore(after, state.unitId)} after={after} animate={animate} />
          </div>
        )}
        <Label as="h1" className={facts.kind === "unit" ? "sx-section" : undefined}>
          Zusammenfassung
        </Label>
        <p className="sx-headline">{text.headline}</p>
        {text.notes.map((note) => (
          <p key={note} className="sx-note">
            {note}
          </p>
        ))}
        {text.lines.length > 0 && <SummaryList className="sx-summary" items={text.lines} />}
      </div>
    ),
    footer: <PrimaryButton onClick={props.onExit}>Zur Linie</PrimaryButton>,
  };
}