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
- `dueCardIds(p, today): string[]` (nur Karten abgeschlossener Haltestellen; Fach, Fälligkeit, Kursreihenfolge)
- `reviewRoundIds(p, today, limit = 40)`, `extraRoundIds(p, today, count = 10)`
- `cardsPerBox(p): Record<Box, number>`, `isRoundTimeUp(startedAtMs, nowMs): boolean`

## tasks.ts
- Typen: `ChoiceTask` (type `recognize | listen | recall | cloze`, `options`, `correctIndex`, `prompt` (`null` bei listen), `speak`, `exampleHint`, `hint`, `solution`, `note`, `example`), `WriteTask`, `BuildTask` (`tokens` gemischt, `answer`), `PairsTask` (`pairs`, `esOrder`, `deOrder`), `RoundTask = ChoiceTask | WriteTask | BuildTask`, `Feedback`, `TaskEnv = { hasSpanishVoice: boolean; writeEnabled?: boolean }`
- `taskTypeForReview(item, box, env): TaskType`
- `makeItemTask(item, type, rng, env): ChoiceTask | WriteTask` (Satzmuster nie „write“; ohne Stimme „listen“ zu „recognize“)
- `makeReviewTask(itemId, box, rng, env)`
- `buildNewCardBlocks(unitId, rng): { items: Item[]; pairs: PairsTask }[]`, `buildClozeTasks(unitId, rng)`, `buildBuildTasks(unitId, rng)`, `buildFinalRoundTasks(unitId, rng, env)`
- `evaluateChoice(task, index): Feedback`, `evaluateWrite(task, text): Feedback`, `evaluateBuild(task, chosenTokens): Feedback`, `isPairMatch(esItemId, deItemId): boolean`
- `speakTextOf(item): string`

## round.ts (Runde mit Wiedervorlage)
- `createRound(tasks): RoundState` (`queue`, `total`, `completed`, `right`, `wrong`)
- `currentTask(round): RoundTask | null`, `isRoundDone(round)`, `isRepeat(round)`
- `answerInRound(p, round, correct, now: Clock): { progress; round; requeued }` (nur die erste Antwort ändert Fach und Punkte; falsch: Wiedervorlage nach frühestens 3 anderen, höchstens 2-mal)

## flow.ts (Inhalte je Schritt)
- Schritt 1: `buildReviewRound(p, day, rng, env, limit = 40): RoundState`
- Schritt 2: `buildNewCards(unitId, rng)` (Blöcke zu vier mit Paare-Aufgabe)
- Schritt 3: `buildClozeRound(unitId, rng): ChoiceTask[]`
- Schritt 5: `buildFinalRound(unitId, rng, env): RoundState` (jede Karte „recognize“ plus Satzbau)
- Freie Runde: `buildExtraRound(p, day, rng, env, count = 10): RoundState`
- Endstation: `buildFinalStationRound(p, rng, env): RoundState`, `finishFinalReview(p, right, total, now)`

## units.ts (Haltestellen, Schritte, Missionen, Startseite)
- `StopState = "locked" | "open" | "running" | "done"`; `stopState(p, unitId)`, `stopStates(p): { unitId; stop; state; step }[]`, `isUnitDone(p, unitId)`, `finalStationState(p): "locked" | "open" | "done"`
- `startUnit(p, unitId, now)` (Schritt 1 entfällt ohne fällige Karten), `currentStep(p, unitId): Step | null`
- `completeStep(p, unitId, step, now)` (wirkt nur, wenn `step` der offene Schritt ist; 2 legt Karten an, 4 gibt 20 Punkte, 5 schließt die Haltestelle ab mit 100 Punkten und Serie; 6 ändert nichts)
- `MissionState = "locked" | "open" | "done" | "skipped"`; `missionState(p, missionId)`, `missionStates(p)`, `openMissionIds(p)` (neueste zuerst)
- `completeMission(p, missionId, now, { feeling?, note? })` (50 Punkte genau einmal, auch nach Überspringen), `skipMission(p, missionId, now)`
- `dueCount(p, day)`, `dayCounter(p, day)`
- `todayPlan(p, day): TodayPlan` mit `kind: "work" | "missionOnly" | "allDone"`, `dueCount`, `reviewCount`, `unitId`, `unitState`, `unitStep`, `newCardCount`, `openMissionId`, `nextUnitId`, `finalStationOpen`

## progress.ts
- `createProgress(name, now): Progress | null`, `normalizeName(name): string | null`
- `updateProfile(p, { name?, voiceURI?, rate?, calm? })`, `toggleFavorite(p, id)`
- `validateProgress(value): Progress | null`
- `parseProgress(raw: string | null): { status: "empty" } | { status: "ok"; progress } | { status: "error"; reason: "unreadable" | "foreign-schema" | "invalid"; raw }`
- `serializeProgress(p): string`

## store.ts
- `createProgressStore({ storage: { getItem, setItem }, now, key? }): ProgressStore`
- `StoreState = { status: "empty" } | { status: "ready"; progress; saveFailed } | { status: "error"; reason; raw }`
- `store.getSnapshot()`, `store.subscribe(listener)`, `store.update(fn)`, `store.createProfile(name): boolean`, `store.restart()`
- React: `useSyncExternalStore(store.subscribe, store.getSnapshot)`
- Bei Zustand `error` schreibt der Speicher nichts, bis `restart()` gerufen wird (der alte Text wird unter `<Schlüssel>:backup-<Zeitpunkt>` gesichert).

## testkit.ts
- Nur für Tests: `makeClock(day)`, `freshProgress(clock, name)`.
