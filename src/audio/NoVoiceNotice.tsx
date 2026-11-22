import { useSyncExternalStore } from "react";
import { Notice } from "../ui";
import { getSpeech } from "./instance";

function subscribe(listener: () => void): () => void {
  return getSpeech().onNoticeChanged(listener);
}

function getSnapshot(): boolean {
  return getSpeech().isNoVoiceNoticeOpen();
}

/**
 * Einmaliger Hinweis (je Start der App), wenn keine spanische Stimme da ist: eine Hinweisleiste aus `src/ui`.
 * Verschwindet mit „Verstanden“ oder sobald eine Stimme erscheint. Gehört an den Anfang der Ansicht oder in `AppShell notice`.
 */
export function NoVoiceNotice() {
  const open = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!open) return null;
  return (
    <Notice
      text="Auf diesem Gerät ist keine spanische Stimme da, darum bleibt der Ton aus. Du kannst eine laden: iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch. Der Pfad kann je nach iOS-Version anders heißen."
      actionLabel="Verstanden"
      onAction={() => getSpeech().dismissNoVoiceNotice()}
    />
  );
}
