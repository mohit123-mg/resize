"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import UPNG from "upng-js";

const TARGET_KB_MAX = 400;

function formatKB(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

async function loadBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressToTarget(file) {
  const bitmap = await loadBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const MAX = TARGET_KB_MAX * 1024;
  const MIN = 300 * 1024;

  // Draw at full resolution to get raw RGBA.
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();
  const imgData = ctx.getImageData(0, 0, w, h);

  // Binary search the palette size (cnum) to hit 300–400 KB at FULL resolution.
  // cnum=0 → lossless PNG (big). cnum=2..256 → palette PNG (much smaller).
  let lo = 2,
    hi = 256;
  let best = null;
  for (let i = 0; i < 8; i++) {
    const cnum = Math.round((lo + hi) / 2);
    const ab = UPNG.encode([imgData.data.buffer], w, h, cnum);
    const size = ab.byteLength;
    if (size > MAX) {
      hi = cnum - 1;
    } else {
      best = { ab, size, cnum };
      if (size >= MIN) break;
      lo = cnum + 1;
    }
    if (lo > hi) break;
  }

  // Fallback: if nothing fit (extreme case), take the smallest palette.
  if (!best) {
    const ab = UPNG.encode([imgData.data.buffer], w, h, 2);
    best = { ab, size: ab.byteLength, cnum: 2 };
  }

  const blob = new Blob([best.ab], { type: "image/png" });
  return { blob, width: w, height: h, origWidth: w, origHeight: h };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b0d10 0%, #111418 100%)",
    color: "#e8eaed",
  },
  wrap: { maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" },
  h1: { fontSize: 32, margin: 0, fontWeight: 700, letterSpacing: -0.5 },
  sub: { color: "#9aa0a6", marginTop: 8, fontSize: 15 },
  drop: (drag) => ({
    marginTop: 24,
    border: `2px dashed ${drag ? "#1a73e8" : "#3c4043"}`,
    borderRadius: 14,
    padding: 48,
    textAlign: "center",
    cursor: "pointer",
    background: drag ? "#14233a" : "#16181c",
    transition: "all .15s ease",
  }),
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
  btn: (primary, disabled) => ({
    background: primary ? "#1a73e8" : "#2a2d31",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: 14,
    fontWeight: 600,
  }),
  stat: { color: "#9aa0a6", fontSize: 13 },
  grid: {
    marginTop: 20,
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  },
  card: {
    background: "#16181c",
    border: "1px solid #2a2d31",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  thumb: {
    width: "100%",
    aspectRatio: "16 / 10",
    objectFit: "cover",
    background: "#0b0d10",
    display: "block",
  },
  cardBody: { padding: 12, display: "flex", flexDirection: "column", gap: 8 },
  nameRow: { display: "flex", gap: 6, alignItems: "center" },
  nameInput: {
    flex: 1,
    background: "#0b0d10",
    border: "1px solid #2a2d31",
    color: "#e8eaed",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    minWidth: 0,
  },
  ext: { color: "#9aa0a6", fontSize: 13 },
  meta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9aa0a6" },
  savings: { color: "#81c995", fontSize: 12, fontWeight: 600 },
  actions: { display: "flex", gap: 8 },
  smallBtn: {
    flex: 1,
    background: "#1a73e8",
    color: "#fff",
    border: "none",
    padding: "8px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
  },
  ghostBtn: {
    background: "#2a2d31",
    color: "#e8eaed",
    border: "none",
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  badge: (kind) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: kind === "done" ? "#143b25" : kind === "error" ? "#3b1414" : "#1e2a3b",
    color: kind === "done" ? "#81c995" : kind === "error" ? "#f28b82" : "#8ab4f8",
  }),
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid #3c4043",
    borderTopColor: "#8ab4f8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
    verticalAlign: "middle",
    marginRight: 6,
  },
};

export default function Page() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    setBusy(true);
    const initial = files.map((f) => ({
      id: crypto.randomUUID(),
      originalName: f.name,
      renameTo: stripExt(f.name) + "-compressed",
      originalSize: f.size,
      originalUrl: URL.createObjectURL(f),
      status: "processing",
      compressedSize: 0,
      compressedUrl: null,
      blob: null,
      timeMs: 0,
      width: 0,
      height: 0,
    }));
    setItems((prev) => [...initial, ...prev]);

    await Promise.all(
      files.map(async (file, idx) => {
        const t0 = performance.now();
        try {
          const { blob, width, height, origWidth, origHeight } = await compressToTarget(file);
          const url = URL.createObjectURL(blob);
          const timeMs = performance.now() - t0;
          setItems((prev) =>
            prev.map((it) =>
              it.id === initial[idx].id
                ? {
                    ...it,
                    status: "done",
                    compressedSize: blob.size,
                    compressedUrl: url,
                    blob,
                    timeMs,
                    width,
                    height,
                    origWidth,
                    origHeight,
                  }
                : it
            )
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === initial[idx].id ? { ...it, status: "error", error: String(err) } : it
            )
          );
        }
      })
    );
    setBusy(false);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  };

  const rename = (id, value) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, renameTo: value } : i)));
  };

  const remove = (id) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.originalUrl) URL.revokeObjectURL(it.originalUrl);
      if (it?.compressedUrl) URL.revokeObjectURL(it.compressedUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => {
      if (i.originalUrl) URL.revokeObjectURL(i.originalUrl);
      if (i.compressedUrl) URL.revokeObjectURL(i.compressedUrl);
    });
    setItems([]);
  };

  const downloadAllZip = async () => {
    const done = items.filter((i) => i.status === "done" && i.blob);
    if (!done.length) return;
    const zip = new JSZip();
    const used = new Set();
    done.forEach((i) => {
      let name = (i.renameTo?.trim() || stripExt(i.originalName)) + ".png";
      let n = name,
        k = 1;
      while (used.has(n)) n = name.replace(/\.png$/, `-${k++}.png`);
      used.add(n);
      zip.file(n, i.blob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compressed-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOriginal = items.reduce((s, i) => s + i.originalSize, 0);
  const totalCompressed = items.reduce((s, i) => s + (i.compressedSize || 0), 0);
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <main style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>Fast Image Compressor</h1>
        <p style={styles.sub}>
          Drop images — each one shrinks to 300–400 KB while keeping full resolution. Runs entirely in your browser.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={styles.drop(drag)}
        >
          <div style={{ fontSize: 18, marginBottom: 6, fontWeight: 600 }}>
            {drag ? "Drop to upload" : "Drop images here or click to select"}
          </div>
          <div style={{ color: "#9aa0a6", fontSize: 13 }}>JPEG · PNG · WebP — bulk supported</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div style={styles.toolbar}>
            <button
              onClick={downloadAllZip}
              disabled={busy || doneCount === 0}
              style={styles.btn(true, busy || doneCount === 0)}
            >
              Download all as ZIP
            </button>
            <button onClick={clearAll} disabled={busy} style={styles.btn(false, busy)}>
              Clear
            </button>
            <div style={styles.stat}>
              {doneCount}/{items.length} done · {formatKB(totalOriginal)} → {formatKB(totalCompressed)}
              {totalOriginal > 0 && totalCompressed > 0 && (
                <span style={{ color: "#81c995", marginLeft: 8, fontWeight: 600 }}>
                  ({((1 - totalCompressed / totalOriginal) * 100).toFixed(0)}% smaller)
                </span>
              )}
            </div>
          </div>
        )}

        <div style={styles.grid}>
          {items.map((i) => (
            <div key={i.id} style={styles.card}>
              <img src={i.compressedUrl || i.originalUrl} alt={i.originalName} style={styles.thumb} />
              <div style={styles.cardBody}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={styles.badge(i.status)}>
                    {i.status === "processing" && <span style={styles.spinner} />}
                    {i.status === "processing" ? "compressing" : i.status === "done" ? "ready" : "error"}
                  </span>
                  <button onClick={() => remove(i.id)} style={styles.ghostBtn} title="Remove">
                    ✕
                  </button>
                </div>

                <div
                  style={{ fontSize: 12, color: "#9aa0a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={i.originalName}
                >
                  {i.originalName}
                </div>

                {i.status === "done" && (
                  <>
                    <div style={styles.nameRow}>
                      <input
                        value={i.renameTo}
                        onChange={(e) => rename(i.id, e.target.value)}
                        style={styles.nameInput}
                        placeholder="filename"
                      />
                      <span style={styles.ext}>.png</span>
                    </div>

                    <div style={styles.meta}>
                      <span>
                        {formatKB(i.originalSize)} → <span style={{ color: "#e8eaed" }}>{formatKB(i.compressedSize)}</span>
                      </span>
                      <span style={styles.savings}>
                        −{((1 - i.compressedSize / i.originalSize) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ ...styles.meta, marginTop: -4 }}>
                      <span>
                        {i.origWidth && (i.origWidth !== i.width || i.origHeight !== i.height) ? (
                          <>
                            {i.origWidth}×{i.origHeight} → <span style={{ color: "#e8eaed" }}>{i.width}×{i.height}</span>
                          </>
                        ) : (
                          <>{i.width}×{i.height}</>
                        )}
                      </span>
                      <span>{(i.timeMs / 1000).toFixed(2)}s</span>
                    </div>

                    <div style={styles.actions}>
                      <a
                        href={i.compressedUrl}
                        download={(i.renameTo?.trim() || stripExt(i.originalName)) + ".png"}
                        style={styles.smallBtn}
                      >
                        Download
                      </a>
                    </div>
                  </>
                )}

                {i.status === "error" && (
                  <div style={{ fontSize: 12, color: "#f28b82" }}>Failed to compress.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
