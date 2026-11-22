import { describe, expect, it } from "vitest";
import {
  buildExport,
  checkImport,
  compareImport,
  EXPORT_FORMAT,
  exportFileName,
  formatDateTime,
  formatDay,
  lastActivityDay,
  summarizeProgress,
  summaryRows,
} from "./backup";
import { updateProfile } from "./progress";
import { createProgressStore } from "./store";
import type { StorageLike } from "./store";
import { freshProgress, makeClock } from "./testkit";
import type { Progress, Step } from "./types";
import { completeStep, startUnit } from "./units";

const clock = makeClock("2026-11-23");

function learned(): Progress {
  let p = startUnit(freshProgress(clock, "Ana-Lena"), "u01", clock.now);
  for (const step of [1, 2, 3, 4, 5] as Step[]) p = completeStep(p, "u01", step, clock.now);
  return { ...p, favorites: ["pb-x-01"], stats: { ...p.stats, activeMsByDay: { "2026-11-23": 600_000 } } };
}

describe("Export", () => {
  it("der Exporttext enthält Kennung, Schema und Datum", () => {
    const text = buildExport(learned(), clock.now);
    const file = JSON.parse(text);
    expect(file.format).toBe(EXPORT_FORMAT);
    expect(file.schema).toBe(1);
    expect(file.exportedAt).toBe(clock.now().toISOString());
    expect(file.progress.profile.name).toBe("Ana-Lena");
  });

  it("der Dateiname enthält das Datum, aber nicht den Namen der Lernenden", () => {
    const name = exportFileName(clock.now);
    expect(name).toBe("guagua-sicherung-2026-11-23.json");
    expect(name).not.toContain("Ana");
  });

  it("Export und anschließender Import ergeben denselben Fortschritt", () => {
    const original = learned();
    const check = checkImport(buildExport(original, clock.now));
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.progress).toEqual(original);
  });

  it("Export, Import über den Speicher und Neuladen ergeben denselben Fortschritt", () => {
    const original = learned();
    const data = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.createProfile("Zweite")).toBe(true);
    const check = checkImport(buildExport(original, clock.now));
    if (!check.ok) throw new Error("Import");
    expect(store.replaceProgress(check.progress).ok).toBe(true);
    const reloaded = createProgressStore({ storage, now: clock.now }).getSnapshot();
    expect(reloaded.status === "ready" && reloaded.progress).toEqual(original);
  });
});

describe("Import prüfen: nichts wird geändert, der Grund wird genannt", () => {
  const reasonOf = (text: string) => {
    const check = checkImport(text);
    if (check.ok) throw new Error("hätte scheitern müssen");
    expect(check.message.length).toBeGreaterThan(10);
    return check.reason;
  };
  const exported = () => JSON.parse(buildExport(learned(), clock.now));

  it("leerer Text", () => {
    expect(reasonOf("")).toBe("empty");
    expect(reasonOf("  \n ")).toBe("empty");
  });

  it("kaputter Text", () => {
    expect(reasonOf("{nicht json")).toBe("unreadable");
    expect(reasonOf(buildExport(learned(), clock.now).slice(0, 200))).toBe("unreadable");
  });

  it("fremde Daten", () => {
    expect(reasonOf('{"foo":1}')).toBe("foreign");
    expect(reasonOf("[1,2,3]")).toBe("foreign");
    expect(reasonOf("null")).toBe("foreign");
    expect(reasonOf(JSON.stringify({ ...exported(), format: "anderes-programm" }))).toBe("foreign");
    // Ein roher Fortschritt ohne Hülle ist keine Sicherung.
    expect(reasonOf(JSON.stringify(learned()))).toBe("foreign");
  });

  it("fremdes Schema", () => {
    expect(reasonOf(JSON.stringify({ ...exported(), schema: 2 }))).toBe("schema");
    const noSchema = exported();
    delete noSchema.schema;
    expect(reasonOf(JSON.stringify(noSchema))).toBe("schema");
  });

  it("Export ohne gültigen Fortschritt", () => {
    expect(reasonOf(JSON.stringify({ ...exported(), progress: null }))).toBe("invalid");
    expect(reasonOf(JSON.stringify({ format: EXPORT_FORMAT, schema: 1, exportedAt: "2026-11-23T10:00:00.000Z" }))).toBe("invalid");
    const bad = exported();
    bad.progress.cards = { "u01-i01": { box: 9, due: "heute", right: 0, wrong: 0, lastSeen: "x" } };
    expect(reasonOf(JSON.stringify(bad))).toBe("invalid");
    const noName = exported();
    noName.progress.profile.name = "  ";
    expect(reasonOf(JSON.stringify(noName))).toBe("invalid");
  });

  it("ein Byte-Order-Mark am Dateianfang stört nicht", () => {
    expect(checkImport("﻿" + buildExport(learned(), clock.now)).ok).toBe(true);
  });
});

describe("Zusammenfassung", () => {
  it("nennt Name, Karten, abgeschlossene Haltestellen, Punkte und Datum des Exports", () => {
    const original = learned();
    const check = checkImport(buildExport(original, clock.now));
    if (!check.ok) throw new Error("Import");
    expect(check.summary).toEqual({
      name: "Ana-Lena",
      cardCount: Object.keys(original.cards).length,
      unitsDone: 1,
      unitsTotal: 10,
      points: original.stats.points,
      calm: false,
      lastActiveOn: "2026-11-23",
      exportedOn: "2026-11-23",
    });
    expect(check.summary.cardCount).toBeGreaterThan(0);
    const rows = summaryRows(check.summary);
    expect(rows.map((row) => row.label)).toEqual([
      "Name",
      "Karten",
      "Abgeschlossene Haltestellen",
      "Zuletzt gelernt",
      "Punkte",
      "Exportiert am",
    ]);
    expect(rows.find((row) => row.label === "Abgeschlossene Haltestellen")?.value).toBe("1 von 10");
    expect(rows.find((row) => row.label === "Exportiert am")?.value).toBe("23.11.2026");
  });

  it("ohne lesbares Datum steht „unbekannt“", () => {
    const text = JSON.stringify({ ...JSON.parse(buildExport(learned(), clock.now)), exportedAt: "gestern" });
    const check = checkImport(text);
    if (!check.ok) throw new Error("Import");
    expect(check.summary.exportedOn).toBeNull();
    expect(summaryRows(check.summary).at(-1)?.value).toBe("unbekannt");
  });

  it("formatDay", () => {
    expect(formatDay("2026-12-03")).toBe("03.12.2026");
  });

  it("formatDateTime: Tag und Uhrzeit in Ortszeit, unlesbar ergibt „unbekannt“", () => {
    expect(formatDateTime(new Date(2026, 10, 23, 9, 5).toISOString())).toBe("23.11.2026, 09:05 Uhr");
    expect(formatDateTime("gestern")).toBe("unbekannt");
  });
});

describe("Alter Export ohne die neueren optionalen Felder", () => {
  it("wird eingelesen: ohne finalRun, finalReview, lastReviewDay und notes", () => {
    const old = JSON.parse(buildExport(learned(), clock.now));
    delete old.progress.finalRun;
    delete old.progress.finalReview;
    delete old.progress.notes;
    delete old.progress.stats.lastReviewDay;
    const text = JSON.stringify(old);
    for (const field of ["finalRun", "finalReview", "lastReviewDay", "notes"]) expect(text).not.toContain(field);
    const check = checkImport(text);
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.progress.profile.name).toBe("Ana-Lena");
      expect(check.progress.notes).toBeUndefined();
      expect(check.summary.unitsDone).toBe(1);
    }
  });
});

describe("Rückfrage: aktueller und importierter Stand nebeneinander", () => {
  const summaryOf = (progress: Progress, exportedAt = "2026-11-23T12:00:00.000Z") => summarizeProgress(progress, exportedAt);
  const later = (day: string): Progress => {
    const c = makeClock(day);
    let p = startUnit(freshProgress(c, "Ana-Lena"), "u01", c.now);
    for (const step of [1, 2, 3, 4, 5] as Step[]) p = completeStep(p, "u01", step, c.now);
    return p;
  };

  it("die Zeilen nennen beide Stände: Karten, Haltestellen, Datum, Punkte", () => {
    const now = learned();
    const cmp = compareImport(summaryOf(now), summaryOf(later("2026-11-25"), "2026-11-25T12:00:00.000Z"));
    expect(cmp.rows.map((r) => r.label)).toEqual(["Name", "Karten", "Abgeschlossene Haltestellen", "Zuletzt gelernt", "Punkte", "Exportiert am"]);
    const dateRow = cmp.rows.find((r) => r.label === "Zuletzt gelernt");
    expect(dateRow).toEqual({ label: "Zuletzt gelernt", current: "23.11.2026", imported: "25.11.2026" });
    expect(cmp.warnings).toEqual([]);
  });

  it("warnt, wenn der importierte Stand weniger Karten hat", () => {
    const full = learned();
    const empty = freshProgress(clock, "Ana-Lena");
    const cmp = compareImport(summaryOf(full), summaryOf(empty));
    expect(cmp.warnings.some((w) => /weniger Karten/.test(w) && w.includes(`${Object.keys(full.cards).length}`))).toBe(true);
    expect(cmp.warnings.some((w) => /weniger abgeschlossene Haltestellen/.test(w))).toBe(true);
  });

  it("warnt, wenn der importierte Stand älter ist, auch bei gleich vielen Karten", () => {
    const current = later("2026-11-25");
    const older = later("2026-11-23");
    const cmp = compareImport(summaryOf(current), summaryOf(older));
    expect(cmp.warnings).toHaveLength(1);
    expect(cmp.warnings[0]).toMatch(/älter/);
    expect(cmp.warnings[0]).toContain("23.11.2026");
    expect(cmp.warnings[0]).toContain("25.11.2026");
  });

  it("keine Warnung, wenn der Import gleich viel oder mehr hat und nicht älter ist", () => {
    const a = learned();
    expect(compareImport(summaryOf(a), summaryOf(a)).warnings).toEqual([]);
  });

  it("im Ruhemodus fehlen die Punkte, bei einem der beiden Stände genügt", () => {
    const a = updateProfile(learned(), { calm: true });
    const b = learned();
    for (const [x, y] of [[a, b], [b, a], [a, a]] as const) {
      const labels = compareImport(summaryOf(x), summaryOf(y)).rows.map((r) => r.label);
      expect(labels).not.toContain("Punkte");
    }
    expect(summaryRows(summaryOf(a)).map((r) => r.label)).not.toContain("Punkte");
  });

  it("lastActivityDay nimmt den spätesten Tag aus Karten, Haltestellen, Missionen und Lernzeit", () => {
    const base = freshProgress(clock, "Ana");
    expect(lastActivityDay(base)).toBeNull();
    const withTime = { ...base, stats: { ...base.stats, activeMsByDay: { "2026-11-24": 1000, "2026-11-20": 5 } } };
    expect(lastActivityDay(withTime)).toBe("2026-11-24");
    const withCard = { ...withTime, cards: { "u01-i01": { box: 1 as const, due: "2026-11-27", right: 0, wrong: 1, lastSeen: "2026-11-26" } } };
    expect(lastActivityDay(withCard)).toBe("2026-11-26");
    expect(lastActivityDay(learned())).toBe("2026-11-23");
  });
});
