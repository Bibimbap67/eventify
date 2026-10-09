import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Icon from "./Icon.js";

const SAME_CODE_MS = 4000; // a ticket held up to the camera is read once, not on every frame
const SCAN_EVERY_MS = 150;

// Draws an image or video frame onto a canvas (shrunk to `maxSide`) and returns the QR text in it, if any.
function readQr(source, width, height, maxSide, inversionAttempts) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, canvas.width, canvas.height, { inversionAttempts })?.data || null;
}

// Camera QR reader with an image upload fallback (no camera, or permission denied).
// Calls onScan(text) once per code; `paused` stops reading while a scan is being checked.
export default function QrScanner({ onScan, paused = false }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const lastRef = useRef({ code: "", at: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  onScanRef.current = onScan;
  pausedRef.current = paused;

  const report = useCallback((code, { force = false } = {}) => {
    const now = Date.now();
    if (!force && code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_MS) return;
    lastRef.current = { code, at: now };
    onScanRef.current(code);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    let stopped = false;
    let frame = 0;
    let stream = null;
    let lastScan = 0;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const tick = (now) => {
          if (stopped) return;
          if (!pausedRef.current && now - lastScan > SCAN_EVERY_MS && video.readyState >= video.HAVE_ENOUGH_DATA) {
            lastScan = now;
            const code = readQr(video, video.videoWidth, video.videoHeight, 640, "dontInvert");
            if (code) report(code);
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch (err) {
        if (stopped) return;
        setError(err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in the browser bar, or upload a photo of the QR instead."
          : "No camera is available here. Upload a photo or screenshot of the QR instead.");
        setRunning(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [running, report]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again
    if (!file) return;
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const code = readQr(bitmap, bitmap.width, bitmap.height, 1400, "attemptBoth");
      if (code) report(code, { force: true });
      else setError("No QR code found in that image. Try a sharper photo with the whole code in view.");
    } catch {
      setError("That file could not be read as an image.");
    }
  };

  return (
    <div className="qr-scanner">
      <div className={`qr-scanner__view${running ? " is-live" : ""}`}>
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        {!running && (
          <div className="qr-scanner__idle">
            <Icon name="qr" size={24} />
            <span>Camera is off</span>
          </div>
        )}
        <span className="qr-scanner__frame" aria-hidden="true" />
      </div>

      <div className="qr-scanner__controls">
        <button
          type="button"
          className={`btn-sm${running ? "" : " btn-sm--yellow"}`}
          onClick={() => {
            setError("");
            setRunning((value) => !value);
          }}
        >
          <Icon name={running ? "camera-off" : "camera"} size={16} /> {running ? "Stop camera" : "Start camera"}
        </button>
        <button type="button" className="btn-sm" onClick={() => fileRef.current?.click()}>
          <Icon name="image" size={16} /> Upload QR image
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
