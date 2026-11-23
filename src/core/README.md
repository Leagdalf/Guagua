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
- `totalActiveMs(p): number`, `activeDays(p): number` (Tage mit aktiver Lernzeit)

## cards.ts (Karteikasten)
- `newCard(today)`, `gradeCard(card, correct, today): CardProgress`
- `recordCardAnswer(p, itemId, correct, today): Progress` (Fach, Fälligkeit, 10 Punkte, Serie)
- `recordPracticeAnswer(p, itemId, today): Progress` (reine Übung: nur `lastSeen` = heute und Serie, kein Fach, keine Punkte)
- `dueCardIds(p, today): string[]` (nur Karten abgeschlossener Haltestellen; Fach, Fälligkeit, Kursreihenfolge)
- `reviewLimit(p): number` (40, nach der Endstation, also mit `finalReview`, `REVIEW_ROUND_AFTER_FINAL` = 20), `reviewRoundIds(p, today, limit = reviewLimit(p))`
- `extraRoundIds(p, today, count = 10, rng?)`: Karten in niedrigen Fächern zuerst, innerhalb eines Fachs zufällig; mit `rng` wählt jeder Start neu, ohne `rng` (zum Zählen) gilt eine feste Reihenfolge
- `oftenWrongCards(p): { item: Item; wrong: number }[]`: reine Funktion für „Oft falsch“ im Spickzettel. Höchstens `OFTEN_WRONG.maxCards` (10) Karten, jede mit mindestens `OFTEN_WRONG.minWrong` (2) falschen ersten Antworten (`cards[id].wrong`), die mit den meisten Fehlern zuerst, bei Gleichstand niedrigeres Fach, dann Kursreihenfolge. Leer, wenn keine Karte zweimal falsch war.
- `cardsPerBox(p): Record<Box, number>`, `isRoundTimeUp(startedAtMs, nowMs): boolean`

## tasks.ts
- Typen: `SayTask` („Sag es laut“: `kind: "say"`, `itemId`, `prompt` Deutsch, `solution`/`speak` Spanisch, `note?`), `ChoiceTask` (type `recognize | listen | recall | cloze`, `options`, `correctIndex`, `prompt` (`null` bei listen), `speak`, `exampleHint`, `hint`, `solution`, `note`, `example`), `WriteTask`, `BuildTask` (`tokens` gemischt, `answer`), `PairsTask` (`pairs`, `esOrder`, `deOrder`), `RoundTask = ChoiceTask | WriteTask | SayTask | BuildTask`, `Feedback = { correct; verdict: "correct" | "accent" | "wrong"; accentHint: string | null (richtige Schreibweise bei „accent“); solution; chosen: string | null (gewählte oder getippte Antwort); note: string | null; example: Example | null }`, `TaskEnv = { hasSpanishVoice: boolean; writeEnabled?: boolean; sayEnabled?: boolean }`
- `isWritable(item)`: wahr für Wörter und Wendungen, die nicht in `WRITE_EXCLUDED_ITEM_IDS` stehen (faire Schreibaufgaben, Spezifikation 2.4)
- `taskTypeForReview(item, box, env, writesSoFar = 0): TaskType`: Fach 1 „recognize“, Fach 2 „listen“, ab Fach 3 für `isWritable`-Karten „write“, solange `writesSoFar < MAX_WRITE_TASKS_PER_ROUND` (6), danach „say“ (`SAY_TASK_ENABLED`, sonst „recall“). Satzmuster und Karten der Ausschlussliste: „recall“.
- `makeItemTask(item, type, rng, env): ChoiceTask | WriteTask | SayTask` („write“ und „say“ werden für nicht `isWritable`-Karten zu „recall“; ohne Stimme „listen“ zu „recognize“)
- `makeReviewTask(itemId, box, rng, env, writesSoFar = 0)`
- `buildNewCardBlocks(unitId, rng): { items: Item[]; pairs: PairsTask }[]`, `buildClozeTasks(unitId, rng)`, `buildBuildTasks(unitId, rng)`, `buildFinalRoundTasks(unitId, rng, env)`
- `evaluateChoice(task, index): Feedback`, `evaluateWrite(task, text): Feedback`, `giveUpWrite(task): Feedback` („Weiß ich nicht“: zeigt die Lösung, falsch), `acceptWrite(feedback): Feedback` („Meine Antwort stimmt auch“: macht eine falsche Eingabe richtig), `evaluateBuild(task, chosenTokens): Feedback`, `isPairMatch(esItemId, deItemId): boolean`
- `speakTextOf(item): string`

## round.ts (Runde mit Wiedervorlage)
- `createRound(tasks, options?: { unitId?; practice? }): RoundState`
- `RoundState`: `queue` (offene Aufgaben, aktuelle zuerst, mit Wiedervorlagen), `attempts` (Antworten je Aufgaben-id), `total` (Aufgaben beim Start ohne Wiedervorlagen), `completed` (davon erstmals beantwortet), `right`, `wrong` (erste Antworten), `unitId?` (Runde gehört zur Abschlussrunde dieser Haltestelle), `practice?` (reine Übung), `finalStation?` (Runde der Endstation: die erste Antwort trägt die Karte in `finalRun.answered` ein und zählt `finalRun.right`)
- `currentTask(round): RoundTask | null`, `isRoundDone(round)`, `isRepeat(round)`
- `answerInRound(p, round, correct, now: Clock): { progress; round; requeued }` (nur die erste Antwort ändert Fach und Punkte; falsch: Wiedervorlage nach frühestens 3 anderen, höchstens 2-mal). Hat die Runde `unitId`, trägt die erste Antwort die Aufgaben-id in `units[unitId].answered` ein. Hat sie `practice`, ändert die erste Antwort nur `lastSeen` (siehe `recordPracticeAnswer`).

## flow.ts (Inhalte je Schritt)
- Schritt 1: `buildReviewRound(p, day, rng, env, limit = reviewLimit(p)): RoundState`. Die Aufgabentypen vergibt `tasksForCards` der Reihe nach: Die ersten sechs Schreibaufgaben bleiben, weitere Karten ab Fach 3 werden „Sag es laut“. Das gilt auch für die freie Runde und die Endstation (nach einem Neuladen mitten in der Endstation zählen die schon beantworteten Karten nicht mit, die Runde darf dann noch einmal bis zu sechs Schreibaufgaben enthalten).
- Schritt 2: `buildNewCards(unitId, rng)` (Blöcke zu vier mit Paare-Aufgabe)
- Schritt 3: `buildClozeRound(unitId, rng): ChoiceTask[]`
- Schritt 5: `buildFinalRound(p, unitId, rng, env): RoundState` (jede Karte „recognize“ plus Satzbau; Signatur neu: `p` vorn). Aufgaben, die in `units[unitId].answered` stehen, fehlen; `total` und der Zähler gelten dann nur für den Rest. Das Feld entfällt mit dem Abschluss der Haltestelle (`completeStep` 5), ein Neuladen mitten in Schritt 5 wertet nichts doppelt.
- Freie Runde: `buildExtraRound(p, day, rng, env, count = 10): RoundState` (wählt bei jedem Start neu, niedrige Fächer zuerst; reine Übung: `practice`, ändert kein Fach, gibt keine Punkte, setzt `lastSeen` auf heute und zählt so für die Serie; Fälliges bleibt fällig)
- Endstation: `startFinalStation(p, rng): Progress` (wählt die 30 Karten einmal, zuerst Fach 1 bis 3, und merkt sie in `finalRun`; läuft sie schon oder ist sie geschafft, unverändert; rufen, wenn die Wiederholrunde davor durch ist), `buildFinalStationRound(p, rng, env): RoundState` (nimmt `finalRun.ids`, Karten in `finalRun.answered` fehlen, `total` zählt nur den Rest; Runde trägt `finalStation`), `finishFinalReview(p, right, total, now)` (speichert `finalReview` und entfernt `finalRun`), `pickFinalStationIds(p, rng, day?)` (mit `day`: heute schon beantwortete Karten nur, wenn sonst keine 30 zusammenkommen, dann zuletzt; `startFinalStation` und `buildFinalStationRound` nehmen `day` als letzten Parameter), `finalStationTaskCount(p)`, `wrongTodayIds(p, day)` (heute gesehen, Fach 1, fällig morgen), `rightAmongAnswered(p, answeredTaskIds, day)` (richtige unter den schon beantworteten Kartenaufgaben der Abschlussrunde, `null` wenn nicht sicher ableitbar)

## units.ts (Haltestellen, Schritte, Missionen, Startseite)
- `StopState = "locked" | "open" | "running" | "done"`; `stopState(p, unitId)`, `stopStates(p): { unitId; stop; state; step }[]`, `isUnitDone(p, unitId)`, `finalStationState(p): "locked" | "open" | "done"`
- `startUnit(p, unitId, now)` (Schritt 1 entfällt, wenn keine Wiederholrunde aussteht; ein gespeicherter Schritt 1 springt dann auf 2), `currentStep(p, unitId): Step | null`
- `reviewPending(p, day): boolean` (Karten fällig und `stats.lastReviewDay` ist nicht `day`)
- `finishReviewRound(p, day): Progress` (setzt `lastReviewDay`; rufen, wenn die Wiederholrunde durch ist oder an der Grenze von 40 Karten oder 6 Minuten endet, nicht bei Abbruch; schließt Schritt 1 nicht ab, das macht `completeStep(…, 1, …)`)
- `sessionPlan(p, unitId | null, day): { review; reviewCount; unitId; step }`: was die Lerneinheit als Nächstes tut. Erst die Wiederholrunde (`review`, `reviewCount` ≤ `reviewLimit`), dann `step` der Haltestelle (nie 1: ein gespeicherter Schritt 1 gilt als erledigt, eine nicht begonnene Haltestelle beginnt bei 2). `unitId` null oder gesperrt/abgeschlossen: `unitId` und `step` sind `null`, die Sitzung dient nur dem Wiederholen. Zuerst `startUnit` rufen.
- `completeStep(p, unitId, step, now)` (wirkt nur, wenn `step` der offene Schritt ist; 2 legt Karten an, 4 gibt 20 Punkte, 5 schließt die Haltestelle ab mit 100 Punkten und Serie; 6 ändert nichts)
- `MissionState = "locked" | "open" | "done" | "skipped"`; `missionState(p, missionId)`, `missionStates(p)`, `openMissionIds(p)` (neueste zuerst)
- `completeMission(p, missionId, now, { feeling?, note? })` (50 Punkte genau einmal, auch nach Überspringen), `skipMission(p, missionId, now)`
- `dueCount(p, day)`, `dayCounter(p, day)` (Kalendertage seit dem Anlegen des Profils, der erste Tag ist 1, keine Obergrenze)
- `todayPlan(p, day): TodayPlan` mit `kind: "work" | "missionOnly" | "allDone"`, `dueCount` (alle fälligen), `reviewPending`, `reviewCount` (≤ `reviewLimit`: 40, nach der Endstation 20; 0 wenn die Runde nicht aussteht), `unitId`, `unitState`, `unitStep` (Schritt nach der Wiederholrunde, nie 1; `null` bei nicht begonnener Haltestelle), `newCardCount`, `openMissionId`, `nextUnitId`, `finalStationOpen` (dann ist `kind` „work“), `finalResult` (`{ right, total }` nach der Endstation, sonst `null`)
  - Keine Haltestelle offen (alle geschafft oder heute schon eine abgeschlossen): `unitId`, `unitState`, `unitStep` sind `null`. `kind` ist `"work"` nur, wenn `reviewPending` (Fall „Nur Wiederholen, alle Haltestellen geschafft“, erkennbar an `unitId === null` und `nextUnitId === null`), sonst `"missionOnly"` oder `"allDone"`.
  - Nach einer beendeten Wiederholrunde zählen übrig gebliebene fällige Karten nicht als Arbeit (`reviewPending` ist falsch, `dueCount` bleibt).
  - Fälle des Design-Dokuments: offen = `unitState "open"`, läuft = `"running"` mit `unitStep`, Wiederholen davor = `reviewPending`.

## progress.ts
- `createProgress(name, now): Progress | null`, `normalizeName(name): string | null`
- `updateProfile(p, { name?, voiceURI?, rate?, calm? })`, `toggleFavorite(p, id)`
- `validateProgress(value): Progress | null` (weist leeren oder zu langen Namen, `finalReview.right > total`, falsche Typen von `units[].answered` und `stats.lastReviewDay` und ein ungültiges `finalRun` (Typen, `right` größer als `answered.length`) zurück)
- `parseProgress(raw: string | null): { status: "empty" } | { status: "ok"; progress } | { status: "error"; reason: "unreadable" | "foreign-schema" | "invalid"; raw }`
- `serializeProgress(p): string`

## store.ts
- `createProgressStore({ storage: { getItem, setItem }, now, key? }): ProgressStore`
- `StoreState = { status: "empty" } | { status: "ready"; progress; saveFailed } | { status: "error"; reason; raw }`
- `store.getSnapshot()`, `store.subscribe(listener)`, `store.update(fn)`, `store.createProfile(name): boolean`, `store.restart(): boolean` (`false`, wenn das Sichern des alten Textes scheitert: Der Speicher bleibt dann im Zustand `error` und überschreibt nichts)
- React: `useSyncExternalStore(store.subscribe, store.getSnapshot)`
- Bei Zustand `error` schreibt der Speicher nichts, bis `restart()` gerufen wird (der alte Text wird unter `<Schlüssel>:backup-n<Zähler>-<Zeitpunkt>` gesichert).

## Offene Punkte
- Keine. Die Endstation wertet nach einem Neuladen nichts doppelt (`Progress.finalRun`). `WRITE_TASK_ENABLED` ist wahr: Wörter und Wendungen ab Fach 3 kommen als „Schreiben“ (höchstens `MAX_WRITE_TASKS_PER_ROUND` je Runde, dann „Sag es laut“, `SAY_TASK_ENABLED`), Satzmuster und die Karten aus `WRITE_EXCLUDED_ITEM_IDS` als „Erinnern“.

## Stellgrößen aus 2.4 und 2.9 (config.ts)
`WRITE_EXCLUDED_ITEM_IDS` (24 Karten ohne eindeutige deutsche Vorgabe), `MAX_WRITE_TASKS_PER_ROUND` (6), `SAY_TASK_ENABLED`, `REVIEW_ROUND_AFTER_FINAL` (20), `OFTEN_WRONG` (`maxCards` 10, `minWrong` 2).

## testkit.ts
- Nur für Tests: `makeClock(day)`, `freshProgress(clock, name)`.

## backup.ts (Fortschritt sichern) und `store.replaceProgress`
- `buildExport(p, now: Clock): string` (JSON mit `format: "guagua-sicherung"`, `schema`, `exportedAt`, `progress`), `exportFileName(now)` (`guagua-sicherung-JJJJ-MM-TT.json`, ohne Namen)
- `checkImport(text): { ok: true; progress; summary } | { ok: false; reason: "empty" | "unreadable" | "foreign" | "schema" | "invalid"; message }`: prüft mit `validateProgress`, ändert nichts. Ein roher Fortschritt ohne Hülle gilt als „foreign“.
- `summarizeProgress(p, exportedAt)`, `summaryRows(summary)`, `formatDay(day)` (`22.11.2026`)
- `store.replaceProgress(next): { ok: true; backupKey: string | null } | { ok: false; reason: "invalid" | "backup-failed" | "save-failed" }`: prüft `validateProgress`, schreibt zuerst den alten Stand (oder bei „error“ den unlesbaren Text) unter `<Schlüssel>:backup-n<Zähler>-<Zeitpunkt>` und liest ihn zurück, erst dann den neuen Stand. Scheitert eine Stufe, bleiben Zustand und gespeicherter Text unverändert. Der fortlaufende Zähler macht jeden Schlüssel eindeutig, eine Sicherung wird nie überschrieben.

## Sicherungen, Import-Vergleich (store.ts, backup.ts)
- `StorageLike` hat zwei optionale Methoden: `removeItem(key)` und `keys(): string[]`. Ohne sie läuft alles weiter, der Speicher löscht dann nichts und kennt keine Sicherung zum Zurückholen. `src/state/index.ts` reicht beide bisher nicht durch (siehe Bericht).
- Sicherungen heißen `<Schlüssel>:backup-n<Zähler>-<ISO-Zeitpunkt>`. Der Zähler (höchster vorhandener plus 1) entscheidet, welche die neueste ist und welche aufgeräumt wird; der Zeitpunkt dient nur der Anzeige, eine zurückgestellte Uhr ändert nichts. Das alte Format `<Schlüssel>:backup-<ISO-Zeitpunkt>[-2]` bleibt lesbar und gilt als älter als jede Sicherung mit Zähler. `BACKUPS_KEPT` = 3: Nach jeder neu geschriebenen Sicherung (`replaceProgress`, `restart`) löscht der Speicher die älteren, nie die eben geschriebene und nie Schlüssel, die nicht auf dieses Muster passen.
- `store.latestBackup(): { key; at; progress } | null`: die neueste Sicherung, die sich als gültiger Fortschritt lesen lässt (unlesbare Texte aus dem Fehlerzustand werden übersprungen). Zurückholen: `store.replaceProgress(info.progress)`; das sichert vorher den aktuellen Stand, ein zweites Zurückholen tauscht also wieder.
- `restart()` schreibt den alten Text jetzt wie `replaceProgress` unter einen freien Schlüssel (überschreibt nie eine Sicherung vom selben Zeitpunkt).
- `backup.ts`: `ImportSummary` hat zusätzlich `calm` und `lastActiveOn`; `lastActivityDay(p)` (spätester Tag aus `lastActiveDay`, Lernzeit, `lastSeen`, Haltestellen, Missionen); `compareImport(current, imported): { rows: { label; current; imported }[]; warnings: string[] }` (Warnung bei weniger Karten, weniger abgeschlossenen Haltestellen und älterem Stand; Punkte fehlen, sobald einer der beiden Stände im Ruhemodus ist); `summaryRows` ohne Punkte im Ruhemodus; `formatDateTime(iso)` (`22.11.2026, 14:05 Uhr`).