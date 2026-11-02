"use client";

import { useEffect, useState } from "react";
import type { TiltStatus } from "./floor/tilt";

type Props = {
  status: TiltStatus;
  onToggle: () => void;
  onCalibrate: () => void;
};

export function LaptopTiltControls({ status, onToggle, onCalibrate }: Props) {
  const [showSetup, setShowSetup] = useState(false);
  const enabled = status.state === "active" || status.state === "connecting" || status.state === "paused";

  useEffect(() => {
    if (status.state === "unavailable") setShowSetup(true);
  }, [status.state]);

  return <div className="laptop-tilt-controls">
    <button onClick={onToggle} aria-pressed={enabled} title="Use your MacBook's motion sensor to steer gravity">
      <span className="tilt-indicator" data-state={status.state} aria-hidden="true" />
      {status.state === "connecting" ? "Connecting tilt…" : status.state === "active" ? "Laptop tilt on" : "Laptop tilt"}
    </button>
    {status.state === "active" && <button onClick={onCalibrate} title="Treat the current laptop position as level">Set level</button>}
    <button className="tilt-setup-button" onClick={() => setShowSetup(value => !value)} aria-expanded={showSetup} aria-controls="laptop-tilt-setup" aria-label="Laptop tilt setup">?</button>
    <span className="tilt-announcement" role="status">{status.message}</span>
    {showSetup && <section id="laptop-tilt-setup" className="tilt-setup" aria-label="Laptop tilt setup">
      <button className="tilt-close" onClick={() => setShowSetup(false)} aria-label="Close tilt setup">×</button>
      <strong>Tilt your MacBook</strong>
      {status.state === "unavailable" && <p>{status.message}</p>}
      <p>Start the local motion helper from this project’s app folder.</p>
      <code>npm run motion</code>
      <p>Keep that terminal open, choose Laptop tilt, and allow local network access if your browser asks. Tilt gently left or right. Set level calibrates your resting position.</p>
      <p>Sensor access depends on the Mac model and macOS permissions. Stop the helper with Control-C when you’re done.</p>
      <a href="https://github.com/onbiggerthingsB/Hackathon/blob/project/onbiggerthingsB/projects/onbiggerthingsB/coding-library/docs/LAPTOP_TILT.md" target="_blank" rel="noreferrer">Setup instructions ↗</a>
    </section>}
  </div>;
}
