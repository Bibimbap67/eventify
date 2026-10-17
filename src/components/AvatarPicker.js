import React, { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal.js";
import Icon from "./Icon.js";

const STAGE = 240; // the crop square on screen, px
const OUTPUT = 256; // the saved photo, px square
const MAX_ZOOM = 3;
const MAX_FILE = 10 * 1024 * 1024;
const PREVIEWS = [["Profile", 96], ["Navbar", 30]];

// Keep the photo covering the whole square: never a gap at an edge.
function clamp(view, size) {
  const k = Math.max(STAGE / size.w, STAGE / size.h) * view.z;
  return { z: view.z, x: Math.min(0, Math.max(STAGE - size.w * k, view.x)), y: Math.min(0, Math.max(STAGE - size.h * k, view.y)) };
}

// Zoom to `z`, keeping the middle of the square where it is.
function zoomAround(view, z, size) {
  const next = Math.min(MAX_ZOOM, Math.max(1, z));
  const c = STAGE / 2;
  const ratio = next / view.z;
  return clamp({ z: next, x: c - (c - view.x) * ratio, y: c - (c - view.y) * ratio }, size);
}

// Change profile picture: choose a photo, then drag and zoom until the square shows the part you
// want, with the profile and navbar sizes previewed live. onSave gets a 256px JPEG data URL, or ""
// for the default DiceBear face (`fallback`).
export default function AvatarPicker({ current, fallback, onSave, onClose }) {
  const [src, setSrc] = useState(current || "");
  const [size, setSize] = useState(null); // the photo's natural size once it loads
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);
  const drag = useRef(null);

  // Free the last chosen file when another replaces it or the dialog closes.
  useEffect(() => () => src.startsWith("blob:") && URL.revokeObjectURL(src), [src]);

  // The wheel zooms. React's onWheel can't cancel the page scroll, so listen directly.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !size) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      setView((v) => zoomAround(v, v.z - e.deltaY * 0.002, size));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [size]);

  const choose = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file, like a JPG or PNG.");
    if (file.size > MAX_FILE) return setError("That photo is over 10 MB. Choose a smaller one.");
    setError("");
    setSize(null);
    setSrc(URL.createObjectURL(file));
  };

  const loaded = (e) => {
    const next = { w: e.target.naturalWidth, h: e.target.naturalHeight };
    const k = Math.max(STAGE / next.w, STAGE / next.h);
    setSize(next);
    setView({ z: 1, x: (STAGE - next.w * k) / 2, y: (STAGE - next.h * k) / 2 });
  };

  const onPointerDown = (e) => {
    if (!size) return;
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const start = drag.current;
    if (start) setView((v) => clamp({ z: v.z, x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py }, size));
  };
  const onKeyDown = (e) => {
    const step = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (!step || !size) return;
    e.preventDefault();
    setView((v) => clamp({ z: v.z, x: v.x + step[0], y: v.y + step[1] }, size));
  };

  const save = async (close) => {
    let photo = "";
    if (src) {
      const k = Math.max(STAGE / size.w, STAGE / size.h) * view.z;
      const r = OUTPUT / STAGE;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // a see-through PNG would turn black as a JPEG
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
      ctx.drawImage(imgRef.current, view.x * r, view.y * r, size.w * k * r, size.h * k * r);
      photo = canvas.toDataURL("image/jpeg", 0.9);
    }
    setSaving(true);
    try {
      await onSave(photo);
      close();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // The same crop, scaled down to a preview box `px` wide.
  const placed = (px) => {
    const k = Math.max(STAGE / size.w, STAGE / size.h) * view.z * (px / STAGE);
    return { width: size.w * k, transform: `translate(${view.x * (px / STAGE)}px, ${view.y * (px / STAGE)}px)` };
  };

  return (
    <Modal title="Change profile picture" onClose={onClose} className="avatar-modal">
      {(close) => (
        <>
          <div className="avatar-picker">
            <div>
              <div
                ref={stageRef}
                className={`avatar-picker__stage${src ? "" : " avatar-picker__stage--empty"}`}
                tabIndex={src ? 0 : -1}
                aria-label="Photo position. Drag, or use the arrow keys."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => { drag.current = null; }}
                onPointerCancel={() => { drag.current = null; }}
                onKeyDown={onKeyDown}
              >
                {src ? (
                  <>
                    <img ref={imgRef} src={src} alt="" draggable="false" onLoad={loaded} onError={() => { setSrc(""); setError("That file couldn't be opened as an image. Try a JPG or PNG."); }} style={size ? placed(STAGE) : { visibility: "hidden" }} />
                    <span className="avatar-picker__grid" aria-hidden="true" />
                  </>
                ) : (
                  <button type="button" className="avatar-picker__empty" onClick={() => fileRef.current.click()}>
                    <Icon name="image" size={28} />
                    Choose a photo
                  </button>
                )}
              </div>
              <label className="avatar-picker__zoom">
                <Icon name="zoomOut" size={18} />
                <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={view.z} disabled={!size} aria-label="Zoom" onChange={(e) => setView((v) => zoomAround(v, Number(e.target.value), size))} />
                <Icon name="zoomIn" size={18} />
              </label>
              <p className="avatar-picker__hint">Drag the photo to move it</p>
            </div>

            <div className="avatar-picker__side">
              <span className="avatar-picker__label">Preview</span>
              {PREVIEWS.map(([label, px]) => (
                <div className="avatar-picker__row" key={label}>
                  <span className="avatar-picker__preview" style={{ width: px, height: px }}>
                    {src && size ? <img src={src} alt="" style={placed(px)} /> : <img className="is-fit" src={fallback} alt="" />}
                  </span>
                  <span className="avatar-picker__label">{label}</span>
                </div>
              ))}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={choose} />
              <button type="button" className="btn-sm" onClick={() => fileRef.current.click()}>
                <Icon name="image" size={16} /> {src ? "Choose another" : "Choose photo"}
              </button>
              {src && (
                <button type="button" className="btn-sm" onClick={() => { setSrc(""); setSize(null); setError(""); }}>
                  Use default avatar
                </button>
              )}
            </div>
          </div>

          {error && <p className="field__error" role="alert">{error}</p>}
          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>Cancel</button>
            <button type="button" className="btn-sm btn-sm--yellow" disabled={saving || Boolean(src && !size)} onClick={() => save(close)}>
              {saving ? "Saving..." : "Save photo"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
