import "./result-logo.css";

export function ResultLogo({ src, paused }: { src: string; paused: boolean }) {
  return (
    <span className="result-logo" aria-hidden="true" data-paused={paused}>
      <img src={src} alt="" width="40" height="40" loading="lazy" />
    </span>
  );
}
