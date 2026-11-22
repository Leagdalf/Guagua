import { describe, expect, it, vi } from "vitest";
import { NAME_MAX_LENGTH, STORAGE_KEY } from "./config";
import { createProgress, parseProgress, serializeProgress, updateProfile, validateProgress } from "./progress";
import { createProgressStore } from "./store";
import type { StorageLike } from "./store";
import { freshProgress, makeClock } from "./testkit";
import type { Progress } from "./types";

const clock = makeClock("2026-11-23");

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
  return { storage: storage satisfies StorageLike, data };
}

describe("Laden", () => {
  it("nichts gespeichert: empty", () => {
    expect(parseProgress(null)).toEqual({ status: "empty" });
  });

  it("gültiger Fortschritt wird gelesen", () => {
    const progress = freshProgress(clock);
    expect(parseProgress(serializeProgress(progress))).toEqual({ status: "ok", progress });
  });

  it("kaputtes JSON ist „unreadable“, fremdes JSON „foreign-schema“, falsche Form „invalid“", () => {
    expect(parseProgress("{nicht json")).toMatchObject({ status: "error", reason: "unreadable" });
    expect(parseProgress("")).toMatchObject({ status: "error", reason: "unreadable" });
    expect(parseProgress('{"foo":1}')).toMatchObject({ status: "error", reason: "foreign-schema" });
    expect(parseProgress('{"schema":2}')).toMatchObject({ status: "error", reason: "foreign-schema" });
    expect(parseProgress("[1,2]")).toMatchObject({ status: "error", reason: "foreign-schema" });
    expect(parseProgress("null")).toMatchObject({ status: "error", reason: "foreign-schema" });
    expect(parseProgress('{"schema":1}')).toMatchObject({ status: "error", reason: "invalid" });
    const broken = { ...freshProgress(clock), cards: { "u01-i01": { box: 9, due: "heute", right: 0, wrong: 0, lastSeen: "x" } } };
    expect(parseProgress(JSON.stringify(broken))).toMatchObject({ status: "error", reason: "invalid" });
  });

  it("strengere Prüfung: Name, Endstation und die neuen Felder", () => {
    const base = freshProgress(clock);
    const invalid = (value: unknown) => validateProgress(JSON.parse(JSON.stringify(value))) === null;
    expect(validateProgress(JSON.parse(JSON.stringify(base)))).not.toBeNull();

    expect(invalid({ ...base, profile: { ...base.profile, name: "" } })).toBe(true);
    expect(invalid({ ...base, profile: { ...base.profile, name: "   " } })).toBe(true);
    expect(invalid({ ...base, profile: { ...base.profile, name: "x".repeat(NAME_MAX_LENGTH + 1) } })).toBe(true);
    expect(invalid({ ...base, profile: { ...base.profile, name: "x".repeat(NAME_MAX_LENGTH) } })).toBe(false);

    const at = "2026-11-23T10:00:00.000Z";
    expect(invalid({ ...base, finalReview: { at, right: 31, total: 30 } })).toBe(true);
    expect(invalid({ ...base, finalReview: { at, right: 30, total: 30 } })).toBe(false);

    expect(invalid({ ...base, stats: { ...base.stats, lastReviewDay: "2026-11-23" } })).toBe(false);
    expect(invalid({ ...base, stats: { ...base.stats, lastReviewDay: 5 } })).toBe(true);
    expect(invalid({ ...base, stats: { ...base.stats, lastReviewDay: "gestern" } })).toBe(true);

    const unit = { step: 5, startedAt: at };
    expect(invalid({ ...base, units: { u01: { ...unit, answered: ["recognize:u01-i01"] } } })).toBe(false);
    expect(invalid({ ...base, units: { u01: { ...unit, answered: "recognize:u01-i01" } } })).toBe(true);
    expect(invalid({ ...base, units: { u01: { ...unit, answered: [1] } } })).toBe(true);
  });

  it("ungültiger Name beim Anlegen", () => {
    expect(createProgress("   ", clock.now)).toBeNull();
    expect(createProgress("x".repeat(31), clock.now)).toBeNull();
    expect(createProgress("  Ana ", clock.now)?.profile.name).toBe("Ana");
  });
});

describe("Speicher", () => {
  it("leerer Speicher: Zustand empty, createProfile legt an und speichert", () => {
    const { storage, data } = fakeStorage();
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.getSnapshot()).toEqual({ status: "empty" });
    expect(store.createProfile("")).toBe(false);
    expect(store.createProfile("Ana")).toBe(true);
    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(JSON.parse(data.get(STORAGE_KEY) ?? "null")).toMatchObject({ schema: 1, profile: { name: "Ana" } });
    expect(store.createProfile("Zweite")).toBe(false);
  });

  it("speichert nach jeder Änderung, benachrichtigt und hält den Schnappschuss stabil", () => {
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: serializeProgress(freshProgress(clock)) });
    const store = createProgressStore({ storage, now: clock.now });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);

    store.update((p) => updateProfile(p, { name: "Eva", rate: "slow" }));
    expect(listener).toHaveBeenCalledTimes(1);
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(store.getSnapshot()).toBe(after);
    expect(JSON.parse(data.get(STORAGE_KEY) ?? "null").profile).toMatchObject({ name: "Eva", rate: "slow" });

    store.update((p) => p); // keine Änderung
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.update((p) => updateProfile(p, { calm: true }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("scheitert das Speichern, bleibt der Stand im Speicher und saveFailed ist gesetzt", () => {
    const { storage } = fakeStorage({ [STORAGE_KEY]: serializeProgress(freshProgress(clock)) });
    const store = createProgressStore({ storage, now: clock.now });
    storage.setItem.mockImplementation(() => {
      throw new Error("voll");
    });
    store.update((p) => updateProfile(p, { name: "Eva" }));
    const snapshot = store.getSnapshot();
    expect(snapshot).toMatchObject({ status: "ready", saveFailed: true });
    if (snapshot.status === "ready") expect(snapshot.progress.profile.name).toBe("Eva");
  });

  it("kaputte Daten: Fehlerzustand, nichts wird überschrieben, bis restart() gerufen wird", () => {
    for (const broken of ["{kaputt", '{"schema":99,"x":1}', '{"schema":1,"cards":5}']) {
      const { storage, data } = fakeStorage({ [STORAGE_KEY]: broken });
      const store = createProgressStore({ storage, now: clock.now });
      expect(store.getSnapshot().status).toBe("error");

      store.update((p) => updateProfile(p, { name: "Eva" }));
      expect(store.createProfile("Eva")).toBe(false);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(data.get(STORAGE_KEY)).toBe(broken);

      store.restart();
      expect(store.getSnapshot()).toEqual({ status: "empty" });
      // Der alte Text bleibt gesichert, der Hauptschlüssel ist erst mit dem neuen Profil ersetzt.
      expect(data.get(STORAGE_KEY)).toBe(broken);
      const backups = [...data.entries()].filter(([key]) => key.startsWith(`${STORAGE_KEY}:backup-`));
      expect(backups).toHaveLength(1);
      expect(backups[0]?.[1]).toBe(broken);

      expect(store.createProfile("Ana")).toBe(true);
      expect(JSON.parse(data.get(STORAGE_KEY) ?? "null").profile.name).toBe("Ana");
    }
  });

  it("restart() meldet den Erfolg", () => {
    const { storage } = fakeStorage({ [STORAGE_KEY]: "{kaputt" });
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.restart()).toBe(true);
    expect(store.restart()).toBe(false); // nicht mehr im Fehlerzustand
  });

  it("scheitert das Sichern, bleibt der Fehlerzustand und nichts wird überschrieben", () => {
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: "{kaputt" });
    const store = createProgressStore({ storage, now: clock.now });
    storage.setItem.mockImplementation(() => {
      throw new Error("voll");
    });
    expect(store.restart()).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ status: "error", raw: "{kaputt" });
    expect(store.createProfile("Ana")).toBe(false);
    expect(data.get(STORAGE_KEY)).toBe("{kaputt");
    expect([...data.keys()]).toEqual([STORAGE_KEY]);
    // Danach klappt der Neustart, sobald das Sichern wieder geht.
    storage.setItem.mockImplementation((key: string, value: string) => {
      data.set(key, value);
    });
    expect(store.restart()).toBe(true);
    expect(store.getSnapshot()).toEqual({ status: "empty" });
  });

  it("wirft getItem, ist das ein Fehlerzustand und kein Absturz", () => {
    const storage: StorageLike = {
      getItem() {
        throw new Error("gesperrt");
      },
      setItem: vi.fn(),
    };
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.getSnapshot()).toMatchObject({ status: "error", reason: "unreadable", raw: null });
    store.restart();
    expect(store.getSnapshot()).toEqual({ status: "empty" });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe("Speicher: Fortschritt ersetzen (Import)", () => {
  const imported = (): Progress => ({ ...freshProgress(clock, "Eva"), stats: { ...freshProgress(clock).stats, points: 340 } });

  it("legt vor dem Ersetzen eine Sicherung des alten Stands an, danach gilt der neue", () => {
    const old = freshProgress(clock, "Ana");
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: serializeProgress(old) });
    const store = createProgressStore({ storage, now: clock.now });
    const listener = vi.fn();
    store.subscribe(listener);

    const result = store.replaceProgress(imported());
    expect(result.ok).toBe(true);
    if (!result.ok || result.backupKey === null) throw new Error("Sicherung fehlt");
    expect(result.backupKey.startsWith(`${STORAGE_KEY}:backup-`)).toBe(true);
    expect(data.get(result.backupKey)).toBe(serializeProgress(old));
    expect(JSON.parse(data.get(STORAGE_KEY) ?? "null").profile.name).toBe("Eva");
    expect(store.getSnapshot()).toMatchObject({ status: "ready", saveFailed: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("die Sicherung wird vor dem neuen Stand geschrieben", () => {
    const { storage } = fakeStorage({ [STORAGE_KEY]: serializeProgress(freshProgress(clock, "Ana")) });
    const store = createProgressStore({ storage, now: clock.now });
    store.replaceProgress(imported());
    const keys = storage.setItem.mock.calls.map((call) => call[0]);
    expect(keys).toHaveLength(2);
    expect(keys[0]?.startsWith(`${STORAGE_KEY}:backup-`)).toBe(true);
    expect(keys[1]).toBe(STORAGE_KEY);
  });

  it("scheitert das Schreiben der Sicherung, bleibt der alte Stand", () => {
    const old = freshProgress(clock, "Ana");
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: serializeProgress(old) });
    const store = createProgressStore({ storage, now: clock.now });
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key !== STORAGE_KEY) throw new Error("voll");
      data.set(key, value);
    });
    expect(store.replaceProgress(imported())).toEqual({ ok: false, reason: "backup-failed" });
    expect(data.get(STORAGE_KEY)).toBe(serializeProgress(old));
    const snapshot = store.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("Zustand");
    expect(snapshot.progress).toEqual(old);
    expect(storage.setItem).toHaveBeenCalledTimes(1); // nur der Versuch der Sicherung
  });

  it("scheitert das Schreiben des neuen Stands, bleibt der alte Stand", () => {
    const old = freshProgress(clock, "Ana");
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: serializeProgress(old) });
    const store = createProgressStore({ storage, now: clock.now });
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === STORAGE_KEY) throw new Error("voll");
      data.set(key, value);
    });
    expect(store.replaceProgress(imported())).toEqual({ ok: false, reason: "save-failed" });
    expect(data.get(STORAGE_KEY)).toBe(serializeProgress(old));
    const snapshot = store.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("Zustand");
    expect(snapshot.progress.profile.name).toBe("Ana");
  });

  it("ein ungültiger Fortschritt wird nicht übernommen und löst nichts aus", () => {
    const { storage } = fakeStorage({ [STORAGE_KEY]: serializeProgress(freshProgress(clock)) });
    const store = createProgressStore({ storage, now: clock.now });
    const broken = { ...freshProgress(clock), cards: 5 } as unknown as Progress;
    expect(store.replaceProgress(broken)).toEqual({ ok: false, reason: "invalid" });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("zwei Importe in derselben Millisekunde überschreiben keine Sicherung", () => {
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: serializeProgress(freshProgress(clock, "Ana")) });
    const store = createProgressStore({ storage, now: clock.now });
    store.replaceProgress(imported());
    store.replaceProgress({ ...imported(), favorites: ["pb-x-01"] });
    expect([...data.keys()].filter((key) => key.includes(":backup-"))).toHaveLength(2);
  });

  it("aus dem Fehlerzustand: der unlesbare Text wird gesichert, dann gilt der Import", () => {
    const { storage, data } = fakeStorage({ [STORAGE_KEY]: "{kaputt" });
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.getSnapshot().status).toBe("error");
    const result = store.replaceProgress(imported());
    expect(result.ok).toBe(true);
    expect([...data.entries()].some(([key, value]) => key.includes(":backup-") && value === "{kaputt")).toBe(true);
    expect(store.getSnapshot().status).toBe("ready");
  });

  it("aus dem leeren Zustand: nichts zu sichern, der Import legt den Stand an", () => {
    const { storage, data } = fakeStorage();
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.replaceProgress(imported())).toEqual({ ok: true, backupKey: null });
    expect(JSON.parse(data.get(STORAGE_KEY) ?? "null").profile.name).toBe("Eva");
    expect(store.getSnapshot().status).toBe("ready");
  });
});