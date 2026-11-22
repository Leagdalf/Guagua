import { useState, type ReactNode } from "react";
import { AnswerList, AnswerRow } from "./AnswerRow";
import { ActionBar, AudioButton, PrimaryButton, TextButton } from "./buttons";
import { applyCalm } from "./calm";
import { Es, Marker } from "./Es";
import { Feedback } from "./Feedback";
import { TextArea, TextField } from "./fields";
import { PairsBoard, type PairItem, type PairState } from "./PairsBoard";
import { SentenceBuilder, type SentenceWord } from "./SentenceBuilder";
import { SummaryList } from "./SummaryList";
import { HomeHeader, HomePage, Label, LessonPage, MissionRow, SimplePage, Today } from "./layout";
import { Line, type LineStop } from "./Line";
import { Mountain } from "./Mountain";
import { Notice } from "./Notice";
import { StopDot } from "./StopDot";
import { TabBar } from "./TabBar";
import type { StopState } from "./types";
import { UnitHeader, UnitProgress } from "./UnitProgress";
import "./preview.css";

const STATES: readonly StopState[] = ["locked", "open", "running", "done"];
const STATE_NAMES: Record<StopState, string> = {
  locked: "gesperrt",
  open: "offen",
  running: "läuft",
  done: "abgeschlossen",
};

const NAMES: ReadonlyArray<readonly [string, string]> = [
  ["¡Hola!", "Begrüßen und vorstellen"],
  ["En el café", "Getränke bestellen"],
  ["Los números", "Zahlen und Preise"],
  ["En el restaurante", "Essen bestellen"],
  ["¿Dónde está?", "Wege und Orte"],
  ["De compras", "Einkaufen"],
  ["Yo y tú", "Ins Gespräch kommen"],
  ["Me gusta", "Vorlieben, Strand und Wetter"],
  ["¿Cuándo?", "Zeiten und Pläne"],
  ["En ruta", "Unterwegs und in der Unterkunft"],
  ["Repaso final", "Endstation · 30 gemischte Aufgaben"],
];

function stopsFor(states: readonly StopState[]): LineStop[] {
  return NAMES.map(([name, topic], i) => ({
    id: `s${i + 1}`,
    name,
    topic,
    state: states[i] ?? "locked",
    terminus: i === 10,
    selectable: states[i] === "done",
  }));
}

const DAY2: readonly StopState[] = ["done", "open"];
const MOUNTAIN_CASES: ReadonlyArray<readonly [string, readonly StopState[]]> = [
  ["Alle gesperrt", []],
  ["Tag 2, offen", DAY2],
  ["Tag 2, läuft", ["done", "running"]],
  ["Fünf abgeschlossen, sechste offen", ["done", "done", "done", "done", "done", "open"]],
  ["Alle zehn abgeschlossen", Array.from({ length: 10 }, (): StopState => "done")],
];

const PAIR_STATES: readonly PairState[] = ["selectable", "selected", "found", "wrong"];
const PAIR_ES = ["el café", "la leche", "el agua", "el zumo"];
const PAIR_DE = ["der Kaffee", "die Milch", "das Wasser", "der Saft"];

function pairItems(texts: readonly string[], states: readonly PairState[]): PairItem[] {
  return texts.map((text, i) => ({ id: `p${i}`, text, state: states[i] ?? "selectable" }));
}

const WORDS: readonly SentenceWord[] = [
  { id: "w1", text: "Quiero" },
  { id: "w2", text: "un" },
  { id: "w3", text: "café" },
  { id: "w4", text: "con" },
  { id: "w5", text: "leche" },
  { id: "w6", text: "por favor." },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pv-section">
      <Label as="h2" tone="accent">
        {title}
      </Label>
      <div className="pv-body">{children}</div>
    </section>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pv-frame">
      <p className="pv-frame__title">{title}</p>
      {children}
    </div>
  );
}

export default function Preview() {
  const [calm, setCalm] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState("line");
  const [placed, setPlaced] = useState<string[]>(["w1", "w2"]);
  const [pairStates, setPairStates] = useState<{ left: PairState[]; right: PairState[] }>({
    left: ["selectable", "selectable", "selectable", "selectable"],
    right: ["selectable", "selectable", "selectable", "selectable"],
  });
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="pv">
      <header className="pv-head">
        <h1>Bausteine</h1>
        <p className="pv-note">Vorschau aller Bausteine in allen Zuständen. Fenster auf 390, 820 und 1180 Pixel Breite ziehen.</p>
        <TextButton
          onClick={() => {
            applyCalm(!calm);
            setCalm(!calm);
          }}
        >
          {calm ? "Ruhemodus ausschalten" : "Ruhemodus einschalten"}
        </TextButton>
      </header>

      <Section title="Spanischer Text und Marker">
        <Es size="card">
          <Marker>un agua sin gas</Marker>
        </Es>
        <Es size="today" as="p">
          <Marker>En el café</Marker>
        </Es>
        <p>
          Mit Kohlensäure: <Es>con gas</Es>. Ein langer spanischer Satz bricht um, und der Marker unterlegt jede Zeile:{" "}
          <Es>
            <Marker>Quería un café con leche y un vaso de agua sin gas, por favor.</Marker>
          </Es>
        </p>
      </Section>

      <Section title="Hauptknopf">
        <PrimaryButton>Mit Wiederholen beginnen</PrimaryButton>
        <PrimaryButton href="#">Als Link</PrimaryButton>
        <Frame title="Gesperrt (zum Beispiel Prüfen ohne Eingabe)">
          <PrimaryButton disabled>Prüfen</PrimaryButton>
        </Frame>
      </Section>

      <Section title="Textknopf und Tonknopf">
        <div className="pv-row">
          <TextButton>Abhaken</TextButton>
          <TextButton disabled>Abhaken (deaktiviert)</TextButton>
        </div>
        <div className="pv-row">
          <AudioButton />
          <AudioButton variant="slow" />
          <AudioButton disabled />
          <AudioButton variant="slow" disabled />
        </div>
      </Section>

      <Section title="Antwortzeile">
        <Frame title="Vor der Antwort: alle wählbar">
          <AnswerList>
            <AnswerRow onClick={() => setPicked("a")}>ein Milchkaffee</AnswerRow>
            <AnswerRow onClick={() => setPicked("b")}>ein Orangensaft</AnswerRow>
            <AnswerRow onClick={() => setPicked("c")}>ein stilles Wasser</AnswerRow>
            <AnswerRow onClick={() => setPicked("d")}>ohne Zucker</AnswerRow>
          </AnswerList>
          <p className="pv-note">{picked ? `Gewählt: ${picked}` : "Noch nichts gewählt."}</p>
        </Frame>
        <Frame title="Nach der Antwort: falsch gewählt, richtig, gesperrt">
          <AnswerList>
            <AnswerRow state="locked">ein Milchkaffee</AnswerRow>
            <AnswerRow state="wrong">ein Orangensaft</AnswerRow>
            <AnswerRow state="correct">ein stilles Wasser</AnswerRow>
            <AnswerRow state="locked">ohne Zucker</AnswerRow>
          </AnswerList>
        </Frame>
        <Frame title="Mit spanischem Text">
          <AnswerList>
            <AnswerRow state="correct">
              <Es size="inherit">Buenos días.</Es>
            </AnswerRow>
            <AnswerRow state="wrong">
              <Es size="inherit">Buenas noches.</Es>
            </AnswerRow>
          </AnswerList>
        </Frame>
      </Section>

      <Section title="Rückmeldung">
        <Frame title="Richtig">
          <Feedback result="correct" solution={<Es>Un agua sin gas, por favor.</Es>} hint={<><Es>sin gas</Es> heißt ohne Kohlensäure.</>} />
        </Frame>
        <Frame title="Falsch">
          <Feedback result="wrong" solution={<Es>Un agua sin gas, por favor.</Es>} hint={<><Es>sin gas</Es> heißt ohne Kohlensäure.</>} />
        </Frame>
        <Frame title="Richtig, achte auf den Akzent">
          <Feedback result="accent" solution={<Es>está</Es>} hint="Ohne Akzent wäre es ein anderes Wort." />
        </Frame>
        <Frame title="Ohne Hinweis">
          <Feedback result="correct" solution={<Es>Buenos días.</Es>} />
        </Frame>
      </Section>

      <Section title="Paare">
        <div className="pv-cols">
          {PAIR_STATES.map((state) => (
            <Frame key={state} title={`Erste Zeile: ${state === "selectable" ? "wählbar" : state === "selected" ? "gewählt" : state === "found" ? "gefunden" : "falsch"}`}>
              <PairsBoard
                left={pairItems(PAIR_ES, [state])}
                right={pairItems(PAIR_DE, [state])}
              />
            </Frame>
          ))}
        </div>
        <Frame title="Bedienbar: erst links, dann rechts tippen (gleiche Nummer ist ein Paar)">
          <PairsBoard
            left={pairItems(PAIR_ES, pairStates.left)}
            right={pairItems(PAIR_DE, pairStates.right)}
            onSelect={(side, id) => {
              const i = Number(id.slice(1));
              const next = { left: [...pairStates.left], right: [...pairStates.right] };
              next[side][i] = next[side][i] === "selected" ? "selectable" : "selected";
              setPairStates(next);
            }}
          />
        </Frame>
      </Section>

      <Section title="Satzbau">
        <Frame title="Zwei Bausteine gesetzt, Tippen setzt oder nimmt zurück">
          <SentenceBuilder
            words={WORDS}
            placed={placed}
            onPlace={(id) => setPlaced([...placed, id])}
            onRemove={(id) => setPlaced(placed.filter((p) => p !== id))}
          />
          <PrimaryButton disabled={placed.length < WORDS.length}>Prüfen</PrimaryButton>
        </Frame>
        <Frame title="Nichts gesetzt">
          <SentenceBuilder words={WORDS} placed={[]} />
        </Frame>
        <Frame title="Alle gesetzt">
          <SentenceBuilder words={WORDS} placed={WORDS.map((w) => w.id)} />
          <PrimaryButton>Prüfen</PrimaryButton>
        </Frame>
      </Section>

      <Section title="Eingabefelder">
        <div className="pv-cols">
          <Frame title="Deutsch, leer">
            <TextField label="Dein Name" placeholder="Vorname" value={name} onChange={setName} />
          </Frame>
          <Frame title="Spanisch, ausgefüllt">
            <TextField label="Schreibe auf Spanisch" spanish defaultValue="Quiero un café." />
          </Frame>
          <Frame title="Suche">
            <TextField label="Suchen" type="search" placeholder="Spanisch oder Deutsch" />
          </Frame>
          <Frame title="Mehrzeilig">
            <TextArea label="Notiz" value={note} onChange={setNote} help="Bleibt auf diesem Gerät." />
          </Frame>
          <Frame title="Mehrzeilig, Spanisch">
            <TextArea label="Schreibe zwei Sätze" spanish defaultValue="Me llamo Ana. Vivo en Berlín." />
          </Frame>
          <Frame title="Gesperrt">
            <TextField label="Dein Name" disabled defaultValue="Ana" />
          </Frame>
        </div>
      </Section>

      <Section title="Zusammenfassung">
        <SummaryList
          items={[
            { label: "Neue Karten", value: "15" },
            { label: "Richtige Antworten", value: "22 von 26" },
            { label: "Punkte", value: "180" },
            { label: "Serie", value: "3 Tage" },
          ]}
        />
      </Section>

      <Section title="Haltepunkt">
        <div className="pv-row">
          {STATES.map((s) => (
            <span key={s} className="pv-dot">
              <StopDot state={s} />
              {STATE_NAMES[s]}
            </span>
          ))}
        </div>
        <div className="pv-row">
          {STATES.map((s) => (
            <span key={s} className="pv-dot">
              <StopDot state={s} terminus />
              Endstation, {STATE_NAMES[s]}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Linie">
        <div className="pv-cols">
          <Frame title="Tag 2: eine abgeschlossen, heute offen">
            <Line title="Deine Linie" summary="1 von 10 abgeschlossen" stops={stopsFor(DAY2)} onSelect={setPicked} />
          </Frame>
          <Frame title="Haltestelle 3 läuft, zwei abgeschlossen">
            <Line stops={stopsFor(["done", "done", "running"])} onSelect={setPicked} />
          </Frame>
        </div>
      </Section>

      <Section title="Berg">
        <div className="pv-cols">
          {MOUNTAIN_CASES.map(([title, states]) => (
            <Frame key={title} title={title}>
              <div className="pv-mountain">
                <Mountain stops={states} />
              </div>
            </Frame>
          ))}
        </div>
      </Section>

      <Section title="Fortschritt der Einheit">
        <Frame title="Schritt 1 von 6">
          <UnitProgress current={1} />
        </Frame>
        <Frame title="Schritt 3 von 6">
          <UnitProgress current={3} />
        </Frame>
        <Frame title="Schritt 6 von 6">
          <UnitProgress current={6} />
        </Frame>
        <Frame title="Kopf der Lerneinheit mit Schließen und Zähler">
          <UnitHeader current={5} counter="5 von 18" />
        </Frame>
      </Section>

      <Section title="Untere Leiste">
        {["line", "missions", "phrasebook", "more"].map((id) => (
          <Frame key={id} title={`Aktiv: ${id}`}>
            <TabBar active={id} />
          </Frame>
        ))}
        <Frame title="Bedienbar">
          <TabBar active={tab} onSelect={setTab} />
        </Frame>
      </Section>

      <Section title="Hinweisleiste">
        <Notice text="Neue Version bereit." actionLabel="Neu laden" />
        <Notice text="Ohne spanische Stimme bleibt der Ton aus. Du kannst die Stimme in den iOS-Einstellungen laden." />
      </Section>

      <Section title="Seitenraster">
        <Frame title="Startseite: Telefon eine Spalte, iPad zwei Spalten, höchstens 1000 px">
          <HomePage
            header={<HomeHeader date="Dienstag, 24. November" progress="Tag 2" stops={["done", "open"]} />}
            today={
              <Today
                label="Heute · Haltestelle 2"
                title="En el café"
                text="Getränke bestellen. Erst 16 Karten wiederholen, dann 15 neue."
              />
            }
            action={
              <ActionBar aboveTabs>
                <PrimaryButton>Mit Wiederholen beginnen</PrimaryButton>
              </ActionBar>
            }
            mission={
              <MissionRow
                title="Dreimal grüßen"
                text="Grüße heute drei Menschen auf Spanisch, passend zur Tageszeit. Verabschiede dich beim Gehen."
                phrases={["Buenos días.", "Buenas tardes.", "Gracias, hasta luego."]}
              />
            }
            line={<Line title="Deine Linie" summary="1 von 10 abgeschlossen" stops={stopsFor(DAY2)} />}
          />
        </Frame>
        <Frame title="Block „Heute“ mit deutscher Zeile">
          <Today label="Heute" title="Für heute fertig" titleLang="de" text="Morgen: Haltestelle 3, Los números" />
        </Frame>
        <Frame title="Lerneinheit: Spalte, auf dem iPad 620 px, Hauptknopf unten">
          <LessonPage
            header={<UnitHeader current={5} counter="5 von 18" />}
            footer={
              <ActionBar>
                <PrimaryButton>Weiter</PrimaryButton>
              </ActionBar>
            }
          >
            <div className="pv-lesson">
              <Label as="h2">Abschlussrunde · Was heißt das?</Label>
              <Es as="p" size="card">
                <Marker>un agua sin gas</Marker>
              </Es>
              <AudioButton />
            </div>
          </LessonPage>
        </Frame>
        <Frame title="Einfache Seite: höchstens 680 px">
          <SimplePage>
            <Label as="h2">Missionen</Label>
            <p>Eine Spalte mit Rand, auf dem iPad höchstens 680 Pixel breit und zentriert.</p>
          </SimplePage>
        </Frame>
      </Section>
    </div>
  );
}
