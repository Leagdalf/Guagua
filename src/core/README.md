# src/core

Lernlogik ohne React und ohne Browser-Speicher. Uhr (`Clock = () => Date`) und Zufall (`Rng`) werden hineingereicht. Alle Funktionen sind unveränderlich: Sie geben ein neues `Progress` zurück oder dasselbe Objekt, wenn nichts zu tun war. Tage sind Text `JJJJ-MM-TT`.

Nicht in diesem Ordner anfassen: `types.ts`, `content.ts`, `config.ts` (AP0).

## time.ts
- `type Clock = () => Date`
- `toDay(date): Day`, `today(now: Clock): Day`, `dayOfIso(iso): Day | null`
- `isDay(v): v is Day`, `addDays(day, n): Day`, `daysBetween(from, to): number`

## random.ts
- `type Rng = () => number`
- `createRng(seed: number | string): Rng` (reproduzierbar; in der App z. B. `createRng(Date.now())`)
- `shuffle<T>(items, rng): T[]`

## answer.ts
- `checkWritten(input, solution): { verdict: "correct" | "accent" | "wrong"; correct: boolean; solution: string }`

## stats.ts
- `addPoints(p, points)`, `reviewedCardsOn(p, day)`, `markStreakDay(p, day)`, `updateStreakAfterReview(p, day)`
- `currentStreak(p, today): number` (0, wenn die Serie gerissen ist)
- `recordActivity(p, lastInputMs: number | null, nowMs, day): Progress` (bei jeder Eingabe rufen, `nowMs` als neues `lastInputMs` merken, `null` nach Hintergrund oder Pause; zählt höchstens 60 s je Abstand)
- `totalActiveMs(p): number`

## cards.ts (Karteikasten)
- `newCard(today)`, `gradeCard(card, correct, today): CardProgress`
- `recordCardAnswer(p, itemId, correct, today): Progress` (Fach, Fälligkeit, 10 Punkte, Serie)
- `recordPracticeAnswer(p, itemId, today): Progress` (reine Übung: nur `lastSeen` = heute und Serie, kein Fach, keine Punkte)
- `dueCardIds(p, today): string[]` (nur Karten abgeschlossener Haltestellen; Fach, Fälligkeit, Kursreihenfolge)
- `reviewRoundIds(p, today, limit = 40)`, `extraRoundIds(p, today, count = 10)`
- `cardsPerBox(p): Record<Box, number>`, `isRoundTimeUp(startedAtMs, nowMs): boolean`

## tasks.ts
- Typen: `ChoiceTask` (type `recognize | listen | recall | cloze`, `options`, `correctIndex`, `prompt` (`null` bei listen), `speak`, `exampleHint`, `hint`, `solution`, `note`, `example`), `WriteTask`, `BuildTask` (`tokens` gemischt, `answer`), `PairsTask` (`pairs`, `esOrder`, `deOrder`), `RoundTask = ChoiceTask | WriteTask | BuildTask`, `Feedback = { correct; verdict: "correct" | "accent" | "wrong"; accentHint: string | null (richtige Schreibweise bei „accent“); solution; chosen: string | null (gewählte oder getippte Antwort); note: string | null; example: Example | null }`, `TaskEnv = { hasSpanishVoice: boolean; writeEnabled?: boolean }`
- `taskTypeForReview(item, box, env): TaskType`
- `makeItemTask(item, type, rng, env): ChoiceTask | WriteTask` (Satzmuster nie „write“; ohne Stimme „listen“ zu „recognize“)
- `makeReviewTask(itemId, box, rng, env)`
- `buildNewCardBlocks(unitId, rng): { items: Item[]; pairs: PairsTask }[]`, `buildClozeTasks(unitId, rng)`, `buildBuildTasks(unitId, rng)`, `buildFinalRoundTasks(unitId, rng, env)`
- `evaluateChoice(task, index): Feedback`, `evaluateWrite(task, text): Feedback`, `evaluateBuild(task, chosenTokens): Feedback`, `isPairMatch(esItemId, deItemId): boolean`
- `speakTextOf(item): string`

## round.ts (Runde mit Wiedervorlage)
- `createRound(tasks, options?: { unitId?; practice? }): RoundState`
- `RoundState`: `queue` (offene Aufgaben, aktuelle zuerst, mit Wiedervorlagen), `attempts` (Antworten je Aufgaben-id), `total` (Aufgaben beim Start ohne Wiedervorlagen), `completed` (davon erstmals beantwortet), `right`, `wrong` (erste Antworten), `unitId?` (Runde gehört zur Abschlussrunde dieser Haltestelle), `practice?` (reine Übung)
- `currentTask(round): RoundTask | null`, `isRoundDone(round)`, `isRepeat(round)`
- `answerInRound(p, round, correct, now: Clock): { progress; round; requeued }` (nur die erste Antwort ändert Fach und Punkte; falsch: Wiedervorlage nach frühestens 3 anderen, höchstens 2-mal). Hat die Runde `unitId`, trägt die erste Antwort die Aufgaben-id in `units[unitId].answered` ein. Hat sie `practice`, ändert die erste Antwort nur `lastSeen` (siehe `recordPracticeAnswer`).

## flow.ts (Inhalte je Schritt)
- Schritt 1: `buildReviewRound(p, day, rng, env, limit = 40): RoundState`
- Schritt 2: `buildNewCards(unitId, rng)` (Blöcke zu vier mit Paare-Aufgabe)
- Schritt 3: `buildClozeRound(unitId, rng): ChoiceTask[]`
- Schritt 5: `buildFinalRound(p, unitId, rng, env): RoundState` (jede Karte „recognize“ plus Satzbau; Signatur neu: `p` vorn). Aufgaben, die in `units[unitId].answered` stehen, fehlen; `total` und der Zähler gelten dann nur für den Rest. Das Feld entfällt mit dem Abschluss der Haltestelle (`completeStep` 5), ein Neuladen mitten in Schritt 5 wertet nichts doppelt.
- Freie Runde: `buildExtraRound(p, day, rng, env, count = 10): RoundState` (reine Übung: `practice`, ändert kein Fach, gibt keine Punkte, setzt `lastSeen` auf heute und zählt so für die Serie; Fälliges bleibt fällig)
- Endstation: `buildFinalStationRound(p, rng, env): RoundState`, `finishFinalReview(p, right, total, now)`

## units.ts (Haltestellen, Schritte, Missionen, Startseite)
- `StopState = "locked" | "open" | "running" | "done"`; `stopState(p, unitId)`, `stopStates(p): { unitId; stop; state; step }[]`, `isUnitDone(p, unitId)`, `finalStationState(p): "locked" | "open" | "done"`
- `startUnit(p, unitId, now)` (Schritt 1 entfällt, wenn keine Wiederholrunde aussteht; ein gespeicherter Schritt 1 springt dann auf 2), `currentStep(p, unitId): Step | null`
- `reviewPending(p, day): boolean` (Karten fällig und `stats.lastReviewDay` ist nicht `day`)
- `finishReviewRound(p, day): Progress` (setzt `lastReviewDay`; rufen, wenn die Wiederholrunde durch ist oder an der Grenze von 40 Karten oder 6 Minuten endet, nicht bei Abbruch; schließt Schritt 1 nicht ab, das macht `completeStep(…, 1, …)`)
- `sessionPlan(p, unitId | null, day): { review; reviewCount; unitId; step }`: was die Lerneinheit als Nächstes tut. Erst die Wiederholrunde (`review`, `reviewCount` ≤ 40), dann `step` der Haltestelle (nie 1: ein gespeicherter Schritt 1 gilt als erledigt, eine nicht begonnene Haltestelle beginnt bei 2). `unitId` null oder gesperrt/abgeschlossen: `unitId` und `step` sind `null`, die Sitzung dient nur dem Wiederholen. Zuerst `startUnit` rufen.
- `completeStep(p, unitId, step, now)` (wirkt nur, wenn `step` der offene Schritt ist; 2 legt Karten an, 4 gibt 20 Punkte, 5 schließt die Haltestelle ab mit 100 Punkten und Serie; 6 ändert nichts)
- `MissionState = "locked" | "open" | "done" | "skipped"`; `missionState(p, missionId)`, `missionStates(p)`, `openMissionIds(p)` (neueste zuerst)
- `completeMission(p, missionId, now, { feeling?, note? })` (50 Punkte genau einmal, auch nach Überspringen), `skipMission(p, missionId, now)`
- `dueCount(p, day)`, `dayCounter(p, day)` (Kalendertage seit dem Anlegen des Profils, der erste Tag ist 1, keine Obergrenze)
- `todayPlan(p, day): TodayPlan` mit `kind: "work" | "missionOnly" | "allDone"`, `dueCount` (alle fälligen), `reviewPending`, `reviewCount` (≤ 40, 0 wenn die Runde nicht aussteht), `unitId`, `unitState`, `unitStep` (Schritt nach der Wiederholrunde, nie 1; `null` bei nicht begonnener Haltestelle), `newCardCount`, `openMissionId`, `nextUnitId`, `finalStationOpen`
  - Keine Haltestelle offen (alle geschafft oder heute schon eine abgeschlossen): `unitId`, `unitState`, `unitStep` sind `null`. `kind` ist `"work"` nur, wenn `reviewPending` (Fall „Nur Wiederholen, alle Haltestellen geschafft“, erkennbar an `unitId === null` und `nextUnitId === null`), sonst `"missionOnly"` oder `"allDone"`.
  - Nach einer beendeten Wiederholrunde zählen übrig gebliebene fällige Karten nicht als Arbeit (`reviewPending` ist falsch, `dueCount` bleibt).
  - Fälle des Design-Dokuments: offen = `unitState "open"`, läuft = `"running"` mit `unitStep`, Wiederholen davor = `reviewPending`.

## progress.ts
- `createProgress(name, now): Progress | null`, `normalizeName(name): string | null`
- `updateProfile(p, { name?, voiceURI?, rate?, calm? })`, `toggleFavorite(p, id)`
- `validateProgress(value): Progress | null` (weist leeren oder zu langen Namen, `finalReview.right > total` und falsche Typen von `units[].answered` und `stats.lastReviewDay` zurück)
- `parseProgress(raw: string | null): { status: "empty" } | { status: "ok"; progress } | { status: "error"; reason: "unreadable" | "foreign-schema" | "invalid"; raw }`
- `serializeProgress(p): string`

## store.ts
- `createProgressStore({ storage: { getItem, setItem }, now, key? }): ProgressStore`
- `StoreState = { status: "empty" } | { status: "ready"; progress; saveFailed } | { status: "error"; reason; raw }`
- `store.getSnapshot()`, `store.subscribe(listener)`, `store.update(fn)`, `store.createProfile(name): boolean`, `store.restart(): boolean` (`false`, wenn das Sichern des alten Textes scheitert: Der Speicher bleibt dann im Zustand `error` und überschreibt nichts)
- React: `useSyncExternalStore(store.subscribe, store.getSnapshot)`
- Bei Zustand `error` schreibt der Speicher nichts, bis `restart()` gerufen wird (der alte Text wird unter `<Schlüssel>:backup-<Zeitpunkt>` gesichert).

## Offene Punkte
- Die Endstation (noch ohne Oberfläche) wertet nach einem Neuladen doppelt: `buildFinalStationRound` kennt keinen Merker beantworteter Aufgaben. Das löst das Paket, das die Endstation baut.

## testkit.ts
- Nur für Tests: `makeClock(day)`, `freshProgress(clock, name)`.
