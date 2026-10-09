import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";

// Printable documents (certificates, ticket passes) are laid out at one fixed width, so the
// preview, the PDF and the PNG all match. The preview scales the document down to fit.
export function DocPreview({ width, children }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    const measure = () => {
      const scale = Math.min(1, box.clientWidth / width);
      setFit({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div className="doc-preview" ref={boxRef} style={{ height: fit.height || undefined }}>
      <div ref={innerRef} className="doc-preview__page" style={{ width, transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
}

// CSS px at 96dpi.
const PAGES = { "A4 landscape": [1123, 794], "A4 portrait": [794, 1123] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Prints `node` alone, centred and scaled to fit one page, from a hidden frame. The page
// behind the dialog never reaches the printer, so "Save as PDF" gives just the document.
export async function printNode(node, { size = "A4 portrait", title = document.title } = {}) {
  const [pageWidth, pageHeight] = PAGES[size];
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;right:0;bottom:0;width:${pageWidth}px;height:${pageHeight}px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(frame);

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join("");
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title></title>${styles}<style>
    @page { size: ${size}; margin: 0; }
    html, body { margin: 0; background: #fff; }
    body { display: grid; place-items: center; width: 100vw; height: calc(100vh - 2px); overflow: hidden; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style></head><body>${node.outerHTML}</body></html>`);
  doc.close();
  doc.title = title;

  // Stylesheets, fonts and the QR image must be in before the print snapshot.
  const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.sheet || new Promise((resolve) => {
    link.addEventListener("load", resolve);
    link.addEventListener("error", resolve);
  }));
  await Promise.race([Promise.all(sheets), wait(2000)]);
  await doc.fonts?.ready;
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => {})));

  const page = doc.body.firstElementChild;
  const scale = Math.min(1, (pageWidth * 0.94) / page.offsetWidth, (pageHeight * 0.94) / page.offsetHeight);
  page.style.zoom = String(scale);

  const win = frame.contentWindow;
  const cleanup = () => frame.remove();
  win.addEventListener("afterprint", () => setTimeout(cleanup, 100));
  setTimeout(cleanup, 60000); // in case afterprint never fires
  win.focus();
  win.print();
}

// Downloads `node` as a PNG at twice its size.
export async function savePng(node, filename) {
  const url = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export const fileSafe = (text) => String(text || "document").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

// A QR code for `text` as a PNG data URL ("" while it is being drawn).
export function useQrCode(text) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    if (!text) {
      setUrl("");
      return undefined;
    }
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 360 })
      .then((dataUrl) => live && setUrl(dataUrl))
      .catch(() => live && setUrl(""));
    return () => {
      live = false;
    };
  }, [text]);
  return url;
}
