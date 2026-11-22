/** Stern als Strichsymbol (1,8 px Strich wie die Symbole aus src/ui). Gemerkt füllt die Klasse `pb-star--on` ihn mit plátano. */
export function StarIcon() {
  return (
    <svg
      className="icon pb-star__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}
