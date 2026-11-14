/**
 * Optional read-aloud using the device's own speech synthesis. It is never required:
 * every instruction is also on screen, and nothing ever uses the microphone.
 * Quality of Arabic voices depends on the device; recorded audio is a later task.
 */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang = "ar"): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.85; // slower for a young listener
    window.speechSynthesis.speak(u);
  } catch {
    // ignore: read-aloud is an optional aid
  }
}
