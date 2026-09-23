import "../resume/_styles/builder.css";
import "../resume/_styles/portal.css";

/**
 * The read-only resume view lives here rather than under `/resume` so that it
 * does not inherit the builder's layout, which paints the whole dark editor
 * canvas. It still needs the builder's stylesheet — that is where the rules
 * making a resume look like a resume live — so the CSS is imported directly
 * and applied to the document alone via `.rb .rb-doc` in the page itself.
 */
export default function ResumesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
