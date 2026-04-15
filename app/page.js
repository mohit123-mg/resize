"use client";

import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";

const TARGET_KB_MIN = 300;
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

function canvasToBlob(canvas, type, quality) {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, quality));
}

async function compressToTarget(file) {
  const bitmap = await loadBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  const outType = "image/jpeg";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();

  const toBlob = async (q) => {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: outType, quality: q });
    return canvasToBlob(canvas, outType, q);
  };

  const MAX = TARGET_KB_MAX * 1024;
  const MIN = TARGET_KB_MIN * 1024;

  let lo = 0.3,
    hi = 0.95;
  let best = await toBlob(hi);
  if (best.size <= MAX) {
    return { blob: best, width: w, height: h, origWidth: w, origHeight: h };
  }
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const blob = await toBlob(mid);
    if (blob.size > MAX) hi = mid;
    else {
      best = blob;
      if (blob.size >= MIN) break;
      lo = mid;
    }
  }
  return { blob: best, width: w, height: h, origWidth: w, origHeight: h };
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 10% -10%, rgba(26,115,232,0.18), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(129,201,149,0.12), transparent 60%), linear-gradient(180deg, #0a0c0f 0%, #0f1216 100%)",
    color: "#e8eaed",
    display: "flex",
    flexDirection: "column",
  },
  wrap: { maxWidth: 1120, width: "100%", margin: "0 auto", padding: "48px 24px 40px", flex: 1 },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 6 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    boxShadow: "0 8px 24px rgba(26,115,232,0.35)",
  },
  h1: {
    fontSize: 34,
    margin: 0,
    fontWeight: 800,
    letterSpacing: -0.8,
    background: "linear-gradient(135deg, #ffffff 0%, #a8c7fa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  sub: { color: "#9aa0a6", marginTop: 6, fontSize: 15, marginLeft: 58 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(129,201,149,0.12)",
    color: "#81c995",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    marginLeft: 58,
    marginTop: 10,
    border: "1px solid rgba(129,201,149,0.2)",
  },
  footer: {
    borderTop: "1px solid #1e2227",
    padding: "16px 28px",
    textAlign: "right",
    color: "#6b7075",
    fontSize: 12,
    background: "rgba(0,0,0,0.25)",
    backdropFilter: "blur(6px)",
  },
  heart: { color: "#f28b82" },
  drop: (drag) => ({
    marginTop: 28,
    border: `2px dashed ${drag ? "#8ab4f8" : "#2a2d31"}`,
    borderRadius: 18,
    padding: 56,
    textAlign: "center",
    cursor: "pointer",
    background: drag
      ? "linear-gradient(180deg, rgba(26,115,232,0.18), rgba(26,115,232,0.08))"
      : "linear-gradient(180deg, rgba(22,24,28,0.8), rgba(17,20,24,0.8))",
    backdropFilter: "blur(8px)",
    transition: "all .2s ease",
    boxShadow: drag ? "0 0 0 4px rgba(26,115,232,0.15)" : "0 1px 0 rgba(255,255,255,0.02) inset",
  }),
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
  btn: (primary, disabled) => ({
    background: primary ? "linear-gradient(135deg, #1a73e8, #4285f4)" : "#24272c",
    color: "#fff",
    border: "none",
    padding: "11px 18px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: primary ? "0 6px 18px rgba(26,115,232,0.35)" : "none",
    transition: "transform .1s ease, box-shadow .1s ease",
  }),
  stat: { color: "#9aa0a6", fontSize: 13 },
  grid: {
    marginTop: 20,
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  },
  card: {
    background: "linear-gradient(180deg, #16181c 0%, #121418 100%)",
    border: "1px solid #23262b",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    transition: "transform .15s ease, border-color .15s ease",
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
    background: "linear-gradient(135deg, #1a73e8, #4285f4)",
    color: "#fff",
    border: "none",
    padding: "9px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(26,115,232,0.3)",
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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.logo}>⚡</div>
          <h1 style={styles.h1}>Fast Image Compressor</h1>
        </div>
        <p style={styles.sub}>
          Drop images — each shrinks to 300–400 KB while keeping full resolution. 100% offline, runs in your browser.
        </p>
        <div style={styles.pill}>● Private · No uploads · Instant</div>

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
            <div key={i.id} style={{ ...styles.card, animation: "fadeIn .25s ease both" }}>
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
      <footer style={styles.footer}>
        Made with <span style={styles.heart}>♥</span> by <strong style={{ color: "#e8eaed" }}>Rohit Joshi</strong>
      </footer>
    </main>
  );
}
