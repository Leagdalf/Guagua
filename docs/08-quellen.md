# Quellen und Prüfstand

Abgerufen am 22.11.2026. Jede Zeile nennt die Aussage in den Unterlagen und die Stelle, an der sie sich nachprüfen lässt.

## Herkunft der Texte

Konzept, Unterlagen und alle spanischen Texte hat Claude (Anthropic) am 22.11.2026 geschrieben und gegengelesen. Ein Mensch mit Spanisch als Muttersprache hat die Inhalte nicht geprüft. Wer vor Ort einen Fehler hört, korrigiert ihn über den Agenten `content-editor`.

## Technik

| Aussage | Quelle |
|---|---|
| Apps, die über ein kostenloses Apple-Konto installiert werden, laufen nach 7 Tagen ab. | Apple, Choosing a Membership: https://developer.apple.com/support/compare-memberships/ |
| Ohne Mac braucht ein Build für ein echtes iPhone das bezahlte Apple Developer Program. | Expo, Apple Developer Program explained: https://expo.dev/blog/apple-developer-program-explained-free-vs-paid |
| Spracherkennung in Web-Apps auf dem Home-Bildschirm ist unter iOS unsicher. Die Quellen widersprechen sich. | WebKit-Fehlerbericht 225298: https://bugs.webkit.org/show_bug.cgi?id=225298 und What PWA Can Do Today: https://whatpwacando.today/speech-recognition |
| Sprachausgabe startet in Safari auf iOS nur aus einer Nutzeraktion heraus. | TestMu AI, Speech Synthesis API browser support: https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/ |
| Die 7-Tage-Grenze für Website-Daten gilt für Safari. Web-Apps auf dem Home-Bildschirm haben einen eigenen Zähler. | WebKit-Blog, Full Third-Party Cookie Blocking and More: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ und WebKit-Fehlerbericht 237350: https://bugs.webkit.org/show_bug.cgi?id=237350 |
| GitHub Pages ist im kostenlosen Tarif für öffentliche Repositorys verfügbar. | GitHub Docs, What is GitHub Pages: https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/what-is-github-pages |
| Subagenten liegen als Markdown mit Frontmatter in `.claude/agents`, das Feld `model` nimmt `sonnet`. | Claude Code Docs: https://code.claude.com/docs/en/sub-agents |
| Das Feld `model` in `.claude/settings.json` wählt das Startmodell. | Claude Code Docs: https://code.claude.com/docs/en/model-config |
| Paketstände in der Spezifikation | Eigene Abfrage mit `npm view <paket> version` am 22.11.2026 |
| Kontrastwerte im Design-Dokument | Eigene Rechnung nach der WCAG-2-Formel für relative Leuchtdichte |
| Zahlen zur Wiederhollast | `node tools/simulate-reviews.mjs` |

## Lernaufwand

| Aussage | Quelle |
|---|---|
| Etwa 90 bis 100 angeleitete Lernstunden bis A1, 180 bis 200 bis A2 (Richtwerte für Englisch). | Cambridge University Press, Introductory Guide to the CEFR (2013): https://cefr.schools.ac.cy/downloads/GuideToCEFR.pdf und Cambridge English, Guided learning hours: https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours |

## Sprache und Kanaren

| Aussage | Wo sie steht | Quelle |
|---|---|---|
| Auf den Kanaren steht ustedes für jede zweite Person Plural, vosotros kommt nicht vor. | Haltestelle 7, Lehrplan | Universidad de La Laguna: https://www.ull.es/portal/hipotesis/vosotros-en-canarias/ |
| z und c vor e oder i klingen wie s, das j ist behaucht. | Haltestelle 1, Aussprache | The Objective, 06.03.2024: https://theobjective.com/espana/2024-03-06/canario-discutir-expresiones/ |
| Der Bus heißt guagua. | Haltestellen 5 und 10 | Wikipedia, Canarian Spanish, Vokabeltabelle: https://en.wikipedia.org/wiki/Canarian_Spanish |
| Barraquito: Herkunft Santa Cruz de Tenerife, Zutaten Kondensmilch, Likör, Kaffee, Milch, Zimt, Zitrone. | Haltestelle 2 | RTVC: https://rtvc.es/el-barraquito-patrimonio-de-tenerife/ und Wikipedia, Barraquito: https://en.wikipedia.org/wiki/Barraquito |
| „Leche y leche“ ist ein Cortado mit Kondensmilch. | Haltestelle 2 | Gazette Life: https://gazettelife.com/?p=31806 |
| Auf den Kanaren gilt IGIC statt IVA. | Haltestelle 3 | Agencia Tributaria Canaria: https://www3.gobiernodecanarias.org/tributos/atc/w/igic-impuesto-general-indirecto-canario- |
| Der plátano de Canarias ist kleiner und süßer als die importierte banana. | Haltestelle 6 | Diario de Avisos, Juni 2023: https://diariodeavisos.elespanol.com/2023/06/platano-de-canarias-diferencias/ |
| Der Passat staut Wolken im Norden Teneriffas, der Süden bleibt trocken. | Haltestelle 8 | Diario de Avisos: https://diariodeavisos.elespanol.com/canariasenred/la-cascada-de-nubes-que-esta-diviendo-la-isla-de-tenerife-tiene-una-explicacion-cientifica-que-pocos-conocen/ |
| Die Kanaren liegen eine Stunde hinter dem Festland, die Medien sagen „una hora menos en Canarias“. | Haltestelle 9 | Aranda Mendíaz und Galván Rodríguez, Una hora menos en Canarias: https://mdc.ulpgc.es/files/original/3e56caa413d49fb92d77af4146962383e020b9d7.pdf |
| Fähren von Los Cristianos nach San Sebastián de La Gomera brauchen etwa 50 Minuten. | Haltestelle 10 | Direct Ferries: https://www.directferries.de/los_cristianos_san_sebastian_de_la_gomera_faehre.htm |
| Notruf 112 in Spanien und der EU. | Sprachführer | Punto de Acceso General: https://administracion.gob.es/pag_Home/Tu-espacio-europeo/derechos-obligaciones/ciudadanos/asistencia-sanitaria/numeros-urgencia |

## Nicht einzeln belegt

Diese Aussagen sind Stoff jedes Spanisch-Lehrbuchs für Anfänger. Ich habe sie aus meinem Sprachwissen geschrieben und nicht mit einer eigenen Quelle belegt:

- Ausspracheregeln für h, ñ, ll und die Betonungsregel
- „Buenos días“ bis zum Mittagessen, „hasta luego“ als üblicher Abschied
- Kartoffeln heißen auf den Kanaren papas, Zubereitung der papas arrugadas, mojo rojo und mojo verde
- Bedeutung von menú del día, caña, café solo, cortado
- alle Grammatikerklärungen und Verbformen
