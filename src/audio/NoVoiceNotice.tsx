import { useSyncExternalStore } from "react";
import { getSpeech } from "./instance";
import "./noVoiceNotice.css";

function subscribe(listener: () => void): () => void {
  return getSpeech().onNoticeChanged(listener);
}

function getSnapshot(): boolean {
  return getSpeech().isNoVoiceNoticeOpen();
}

/**
 * Einmaliger Hinweis (je Start der App), wenn keine spanische Stimme da ist.
 * Verschwindet mit „Verstanden“ oder sobald eine Stimme erscheint.
 */
export function NoVoiceNotice() {
  const open = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!open) return null;
  return (
    <div className="nvn" role="status">
      <p className="nvn-text">
        Auf diesem Gerät ist keine spanische Stimme da, darum bleibt der Ton aus. Du kannst eine laden: iOS-Einstellungen,
        Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch. Der Pfad kann je nach iOS-Version anders heißen.
      </p>
      <button type="button" className="nvn-button" onClick={() => getSpeech().dismissNoVoiceNotice()}>
        Verstanden
      </button>
    </div>
  );
}
