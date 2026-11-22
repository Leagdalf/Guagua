import { describe, expect, it } from "vitest";
import { units } from "../../core/content";
import { validateProgress } from "../../core/progress";
import { freshProgress, makeClock } from "../../core/testkit";
import type { Progress } from "../../core/types";
import { addNote, cleanNote, hasShareable, missionNotes, noteDate, noteEntries, NOTE_MAX_LENGTH, removeNote, shareText } from "./feedbackModel";

const clock = makeClock("2026-11-23");

function withMission(p: Progress, index: number, mission: Progress["missions"][string]): Progress {
  const unit = units[index];
  if (!unit) throw new Error("Inhalte");
  return { ...p, missions: { ...p.missions, [unit.mission.id]: mission } };
}

describe("Notizen", () => {
  it("eine Notiz wird mit Datum angehängt, der Lernstand bleibt gültig", () => {
    const p = addNote(freshProgress(clock, "Ana"), "  Hat mir gefehlt  ", clock.now);
    expect(p.notes).toEqual([{ at: clock.now().toISOString(), text: "Hat mir gefehlt" }]);
    expect(validateProgress(JSON.parse(JSON.stringify(p)))).not.toBeNull();
  });

  it("leere Notiz ändert nichts, lange Notiz wird gekürzt", () => {
    const p = freshProgress(clock);
    expect(addNote(p, "   \n ", clock.now)).toBe(p);
    expect(cleanNote("x".repeat(NOTE_MAX_LENGTH + 50))?.length).toBe(NOTE_MAX_LENGTH);
  });

  it("Liste: neueste zuerst, Datum lesbar", () => {
    const c = makeClock("2026-11-23");
    let p = addNote(freshProgress(c), "erste", c.now);
    c.advance(2);
    p = addNote(p, "zweite", c.now);
    const entries = noteEntries(p);
    expect(entries.map((e) => e.text)).toEqual(["zweite", "erste"]);
    expect(noteDate(entries[0]?.at ?? "")).toBe("25.11.2026");
    expect(noteDate("kaputt")).toBe("ohne Datum");
  });

  it("einzeln löschen: nur die gewählte Notiz verschwindet", () => {
    let p = freshProgress(clock);
    for (const text of ["a", "b", "c"]) p = addNote(p, text, clock.now);
    const b = noteEntries(p).find((e) => e.text === "b");
    const after = removeNote(p, b?.index ?? -1);
    expect(after.notes?.map((n) => n.text)).toEqual(["a", "c"]);
    expect(removeNote(after, 9)).toBe(after);
    expect(removeNote(freshProgress(clock), 0)).toEqual(freshProgress(clock));
  });
});

describe("Text zum Teilen", () => {
  it("leer, solange es nichts gibt", () => {
    const p = freshProgress(clock);
    expect(hasShareable(p)).toBe(false);
    expect(shareText(p)).toBe("");
  });

  it("enthält alle Notizen und die Notizen der Missionen, aber nicht den Namen der Lernenden", () => {
    const c = makeClock("2026-11-23");
    let p = freshProgress(c, "Zebrafinke");
    p = addNote(p, "Hat mir gefehlt: Taxi", c.now);
    c.advance(1);
    p = addNote(p, "Fehler gefunden bei u01-i03", c.now);
    p = withMission(p, 0, { state: "done", at: "2026-11-23T10:00:00.000Z", feeling: "schwer", note: "Der Kellner sprach schnell" });
    p = withMission(p, 1, { state: "done", at: "2026-11-24T10:00:00.000Z", feeling: "leicht" }); // ohne Notiz
    p = withMission(p, 2, { state: "skipped", at: "2026-11-24T11:00:00.000Z", note: "  " }); // leere Notiz
    const text = shareText(p);
    expect(hasShareable(p)).toBe(true);
    expect(text).toContain("23.11.2026: Hat mir gefehlt: Taxi");
    expect(text).toContain("24.11.2026: Fehler gefunden bei u01-i03");
    expect(text).toContain("Der Kellner sprach schnell");
    expect(text).toContain("(schwer)");
    expect(text).toContain(`Haltestelle 1, ${units[0]?.mission.title_de}`);
    expect(text).not.toContain(units[1]?.mission.title_de ?? "§");
    expect(text).not.toContain("Zebrafinke");
    // Älteste Notiz zuerst.
    expect(text.indexOf("Taxi")).toBeLessThan(text.indexOf("Fehler gefunden"));
  });

  it("nur Missionsnotizen reichen zum Teilen", () => {
    const p = withMission(freshProgress(clock), 0, { state: "done", at: "2026-11-23T10:00:00.000Z", note: "Lief gut" });
    expect(missionNotes(p)).toHaveLength(1);
    expect(shareText(p)).toContain("Lief gut");
    expect(shareText(p)).not.toContain("Notizen\n");
  });
});
