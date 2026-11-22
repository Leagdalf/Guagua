/** Ersetzt `{name}` in Lerninhalten (zum Beispiel im Dialog) durch den Namen aus dem Profil. */
export function fillName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}
