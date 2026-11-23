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

describe("Speicher: drei neueste Sicherungen behalten, letzte zurückholen", () => {
  function memory(withRemove = true, withKeys = true) {
    const data = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
    if (withRemove) storage.removeItem = (key) => void data.delete(key);
    if (withKeys) storage.keys = () => [...data.keys()];
    return { storage, data };
  }
  const backupKeys = (data: Map<string, string>) => [...data.keys()].filter((key) => key.includes(":backup-")).sort();
  const named = (name: string): Progress => freshProgress(clock, name);

  it("nach dem vierten Ersetzen bleiben nur die drei neuesten Sicherungen", () => {
    const c = makeClock("2026-11-20");
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: c.now });
    const written: string[] = [];
    for (const name of ["A", "B", "C", "D"]) {
      c.advance(1);
      const result = store.replaceProgress(named(name));
      if (!result.ok || result.backupKey === null) throw new Error("Sicherung");
      written.push(result.backupKey);
    }
    expect(backupKeys(data)).toEqual(written.slice(1).sort());
    expect(data.has(written[0] as string)).toBe(false);
    // Die neueste Sicherung ist der Stand vor dem letzten Ersetzen.
    expect(store.latestBackup()?.progress.profile.name).toBe("C");
  });

  it("gleicher Zeitpunkt: der Zähler steigt, es bleiben die drei neuesten", () => {
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: clock.now });
    for (let i = 1; i <= 12; i++) store.replaceProgress(named(`N${i}`));
    expect(backupKeys(data)).toHaveLength(3);
    // Die neueste Sicherung hält den Stand vor dem zwölften Ersetzen.
    expect(store.latestBackup()?.progress.profile.name).toBe("N11");
    expect(backupKeys(data).some((key) => key.includes(":backup-n12-"))).toBe(true);
    expect(backupKeys(data).some((key) => key.includes(":backup-n2-"))).toBe(false);
  });

  it("Uhr zurückgestellt: die zuletzt angelegte Sicherung ist die neueste und bleibt beim Aufräumen", () => {
    const c = makeClock("2026-11-20");
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: c.now });
    for (const name of ["A", "B", "C"]) {
      c.advance(1);
      store.replaceProgress(named(name));
    }
    // Uhr um zehn Tage zurück: die neuen Sicherungen tragen frühere Zeitpunkte.
    c.advance(-10);
    for (const name of ["D", "E"]) {
      c.advance(1);
      expect(store.replaceProgress(named(name)).ok).toBe(true);
    }
    expect(backupKeys(data)).toHaveLength(3);
    // Neueste Sicherung = Stand vor dem letzten Ersetzen (D), obwohl ihr Zeitpunkt der früheste ist.
    expect(store.latestBackup()?.progress.profile.name).toBe("D");
    const names = backupKeys(data).map((k) => parseProgress(data.get(k) ?? null)).map((r) => (r.status === "ok" ? r.progress.profile.name : "?"));
    expect(names.sort()).toEqual(["C", "D", "B"].sort());
  });

  it("Sicherungen im alten Format werden gefunden und gelten als älter als jede mit Zähler", () => {
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    data.set(`${STORAGE_KEY}:backup-2030-01-01T00:00:00.000Z`, serializeProgress(named("AltSpät")));
    data.set(`${STORAGE_KEY}:backup-2026-01-01T00:00:00.000Z-2`, serializeProgress(named("AltFrüh")));
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.latestBackup()?.progress.profile.name).toBe("AltSpät");
    expect(store.latestBackup()?.at).toBe("2030-01-01T00:00:00.000Z");
    expect(store.replaceProgress(named("Neu")).ok).toBe(true);
    expect(store.latestBackup()?.progress.profile.name).toBe("Start");
    // Zwei weitere Ersetzungen: die alten Schlüssel fallen zuerst weg, spätere Datumsangabe hin oder her.
    store.replaceProgress(named("Neu2"));
    store.replaceProgress(named("Neu3"));
    expect(backupKeys(data).some((key) => key.includes("2030-01-01"))).toBe(false);
    expect(backupKeys(data).some((key) => key.includes("2026-01-01"))).toBe(false);
    expect(backupKeys(data)).toHaveLength(3);
  });

  it("fremde Schlüssel und Schlüssel ohne Zeitpunkt löscht der Speicher nie", () => {
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    data.set("andere-app", "x");
    data.set(`${STORAGE_KEY}:backup-von-hand`, "y");
    const store = createProgressStore({ storage, now: clock.now });
    for (let i = 0; i < 6; i++) store.replaceProgress(named(`N${i}`));
    expect(data.get("andere-app")).toBe("x");
    expect(data.get(`${STORAGE_KEY}:backup-von-hand`)).toBe("y");
  });

  it("ohne removeItem löscht der Speicher nichts und stürzt nicht ab", () => {
    const { storage, data } = memory(false, true);
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: clock.now });
    for (let i = 0; i < 5; i++) expect(store.replaceProgress(named(`N${i}`)).ok).toBe(true);
    expect(backupKeys(data)).toHaveLength(5);
  });

  it("ohne keys kennt der Speicher keine Sicherung zum Zurückholen, Ersetzen und Löschen laufen weiter", () => {
    const { storage, data } = memory(true, false);
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: clock.now });
    for (let i = 0; i < 5; i++) expect(store.replaceProgress(named(`N${i}`)).ok).toBe(true);
    expect(store.latestBackup()).toBeNull();
    expect(backupKeys(data)).toHaveLength(5);
  });

  it("wirft keys oder removeItem, bleibt alles heil", () => {
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Start")));
    const store = createProgressStore({ storage, now: clock.now });
    storage.removeItem = () => {
      throw new Error("gesperrt");
    };
    for (let i = 0; i < 5; i++) expect(store.replaceProgress(named(`N${i}`)).ok).toBe(true);
    storage.keys = () => {
      throw new Error("gesperrt");
    };
    expect(store.latestBackup()).toBeNull();
    expect(store.replaceProgress(named("Ende")).ok).toBe(true);
  });

  it("keine Sicherung: latestBackup ist null", () => {
    const { storage } = memory();
    expect(createProgressStore({ storage, now: clock.now }).latestBackup()).toBeNull();
  });

  it("latestBackup überspringt unlesbare Sicherungen und nimmt die neueste gültige", () => {
    const c = makeClock("2026-11-20");
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Alt")));
    const store = createProgressStore({ storage, now: c.now });
    c.advance(1);
    store.replaceProgress(named("Mitte"));
    c.advance(1);
    data.set(STORAGE_KEY, "{kaputt");
    const broken = createProgressStore({ storage, now: c.now });
    expect(broken.getSnapshot().status).toBe("error");
    expect(broken.restart()).toBe(true); // sichert den kaputten Text als neueste Sicherung
    expect(backupKeys(data).some((key) => data.get(key) === "{kaputt")).toBe(true);
    expect(broken.latestBackup()?.progress.profile.name).toBe("Alt");
  });

  it("Zurückholen: replaceProgress mit der Sicherung sichert den aktuellen Stand und gilt danach", () => {
    const c = makeClock("2026-11-20");
    const { storage, data } = memory();
    data.set(STORAGE_KEY, serializeProgress(named("Eins")));
    const store = createProgressStore({ storage, now: c.now });
    c.advance(1);
    store.replaceProgress(named("Zwei"));
    const backup = store.latestBackup();
    if (!backup) throw new Error("Sicherung");
    expect(backup.progress.profile.name).toBe("Eins");
    expect(backup.at).toBe(c.now().toISOString());
    c.advance(1);
    expect(store.replaceProgress(backup.progress).ok).toBe(true);
    const snapshot = store.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.progress.profile.name).toBe("Eins");
    // Der Stand vor dem Zurückholen ist jetzt die neueste Sicherung.
    expect(store.latestBackup()?.progress.profile.name).toBe("Zwei");
  });

  it("restart() überschreibt keine Sicherung vom selben Zeitpunkt", () => {
    const { storage, data } = memory();
    data.set(STORAGE_KEY, "{kaputt");
    const store = createProgressStore({ storage, now: clock.now });
    const first = `${STORAGE_KEY}:backup-${clock.now().toISOString()}`;
    data.set(first, "vorhanden");
    expect(store.restart()).toBe(true);
    expect(data.get(first)).toBe("vorhanden");
    expect(backupKeys(data).filter((key) => data.get(key) === "{kaputt")).toHaveLength(1);
  });
});