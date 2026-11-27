"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, Ban, Check, CheckCircle2, ChevronDown, FileImage, ImagePlus,
  LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, Trash2,
  UploadCloud, X, Zap,
} from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg"];
const API_URL = process.env.NEXT_PUBLIC_CONVERTER_API?.replace(/\/$/, "");

type Item = {
  id: string;
  file: File;
  previewUrl: string;
  status: "ready" | "converting" | "done" | "error";
  outputUrl?: string;
  outputSize?: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function getOutputDimensions(sourceWidth: number, sourceHeight: number, widthValue: string, heightValue: string, keepAspectRatio: boolean, preventUpscaling: boolean) {
  const requestedWidth = Number(widthValue) > 0 ? Math.min(12000, Math.round(Number(widthValue))) : undefined;
  const requestedHeight = Number(heightValue) > 0 ? Math.min(12000, Math.round(Number(heightValue))) : undefined;
  if (!requestedWidth && !requestedHeight) return { width: sourceWidth, height: sourceHeight };
  if (keepAspectRatio) {
    const scale = requestedWidth && requestedHeight
      ? Math.min(requestedWidth / sourceWidth, requestedHeight / sourceHeight)
      : requestedWidth ? requestedWidth / sourceWidth : requestedHeight! / sourceHeight;
    const safeScale = preventUpscaling ? Math.min(scale, 1) : scale;
    return { width: Math.max(1, Math.round(sourceWidth * safeScale)), height: Math.max(1, Math.round(sourceHeight * safeScale)) };
  }
  return {
    width: Math.max(1, Math.round(preventUpscaling ? Math.min(requestedWidth ?? sourceWidth, sourceWidth) : requestedWidth ?? sourceWidth)),
    height: Math.max(1, Math.round(preventUpscaling ? Math.min(requestedHeight ?? sourceHeight, sourceHeight) : requestedHeight ?? sourceHeight)),
  };
}

async function resizeImage(file: File, width: number, height: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare the resized image.");
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not resize this image.")), file.type,
        file.type === "image/jpeg" ? 0.96 : undefined);
    });
  } finally {
    bitmap.close();
  }
}

export default function Converter() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(82);
  const [resizeMode, setResizeMode] = useState<"original" | "custom">("original");
  const [targetWidth, setTargetWidth] = useState("1200");
  const [targetHeight, setTargetHeight] = useState("");
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [preventUpscaling, setPreventUpscaling] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
      }
    };
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const next: Item[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!ACCEPTED.includes(file.type)) {
        errors.push(`${file.name}: choose a PNG or JPEG image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: larger than the 10 MB limit.`);
        continue;
      }
      if (file.size === 0) {
        errors.push(`${file.name}: file is empty.`);
        continue;
      }
      next.push({ id: makeId(), file, previewUrl: URL.createObjectURL(file), status: "ready", sourceWidth: 0, sourceHeight: 0 });
    }

    const measured = await Promise.all(next.map(async (item) => {
      try {
        const bitmap = await createImageBitmap(item.file);
        const dimensions = { sourceWidth: bitmap.width, sourceHeight: bitmap.height };
        bitmap.close();
        return { ...item, ...dimensions };
      } catch {
        URL.revokeObjectURL(item.previewUrl);
        errors.push(`${item.file.name}: this image could not be opened.`);
        return null;
      }
    }));
    setItems((current) => [...current, ...measured.filter((item): item is Item => item !== null)]);
    setNotice(errors.join(" "));
  }, []);

  const updateItem = (id: string, update: Partial<Item>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const convertOne = async (item: Item) => {
    if (!API_URL) throw new Error("Converter API URL is not configured.");

    updateItem(item.id, { status: "converting", error: undefined });

    const outputDimensions = resizeMode === "custom"
      ? getOutputDimensions(item.sourceWidth, item.sourceHeight, targetWidth, targetHeight, keepAspectRatio, preventUpscaling)
      : { width: item.sourceWidth, height: item.sourceHeight };
    const shouldResize = outputDimensions.width !== item.sourceWidth || outputDimensions.height !== item.sourceHeight;
    const uploadBlob = shouldResize ? await resizeImage(item.file, outputDimensions.width, outputDimensions.height) : item.file;

    const response = await fetch(`${API_URL}/convert?quality=${quality}`, {
      method: "POST",
      headers: { "Content-Type": uploadBlob.type || item.file.type, "X-API-Key": process.env.NEXT_PUBLIC_API_KEY ?? "", },
      body: uploadBlob,
    });

    if (!response.ok) {
      let message = "Conversion failed. Please try again.";
      try {
        const data = await response.json() as { error?: string };
        if (data.error) message = data.error;
      } catch { }
      throw new Error(message);
    }

    const blob = await response.blob();
    if (blob.type && blob.type !== "image/webp") {
      throw new Error("The converter returned an unexpected file format.");
    }

    const outputUrl = URL.createObjectURL(blob);
    updateItem(item.id, {
      status: "done",
      outputUrl,
      outputSize: blob.size,
      outputWidth: outputDimensions.width,
      outputHeight: outputDimensions.height,
    });
  };

  const convertAll = async () => {
    const pending = items.filter((item) => item.status === "ready" || item.status === "error");
    if (!pending.length || busy) return;
    setBusy(true);
    setNotice("");

    // Sequential processing keeps concurrency and memory use predictable.
    for (const item of pending) {
      try {
        await convertOne(item);
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Conversion failed",
        });
      }
    }
    setBusy(false);
  };

  const download = (item: Item) => {
    if (!item.outputUrl) return;
    const anchor = document.createElement("a");
    anchor.href = item.outputUrl;
    anchor.download = `${item.file.name.replace(/\.[^.]+$/, "")}.webp`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const remove = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    setItems((current) => current.filter((entry) => entry.id !== id));
    if (previewItemId === id) setPreviewItemId(null);
  };

  const clearAll = () => {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    setItems([]);
    setPreviewItemId(null);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const completed = items.filter((item) => item.status === "done").length;
  const remainingCount = items.filter((item) => item.status === "ready" || item.status === "error").length;
  const ready = remainingCount > 0;
  const allDone = items.length > 0 && completed === items.length;
  const previewItem = items.find((item) => item.id === previewItemId && item.status === "done" && item.outputUrl);

  return (
    <main className="min-h-screen px-4 pb-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between py-6">
        <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176f4e] text-white">
            <ImagePlus size={19} />
          </span>
          <span>WebP <span className="text-[#16875b]">Converter</span><span className="ml-1 text-xs font-medium text-[#718078]">by ByteLabs</span></span>
        </a>
        <div className="hidden items-center gap-5 text-sm text-[#718078] sm:flex">
          <span className="flex items-center gap-1.5"><LockKeyhole size={14} /> Private by design</span>
          <span className="flex items-center gap-1.5"><Zap size={14} /> No sign-up</span>
          <span className="flex items-center gap-1.5"><Ban size={14} /> No ads</span>
        </div>
        <span className="rounded-full border border-[#dce9df] bg-white px-3 py-1.5 text-xs font-medium text-[#347858]">Free image tool</span>
      </header>

      <section className="mx-auto max-w-6xl pt-10 text-center sm:pt-16">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-white px-3 py-1.5 text-xs font-medium text-[#347858]">
          <Sparkles size={13} /> A simpler way to optimize images
        </div>
        <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[#17221f] sm:text-6xl">
          Convert to <span className="text-[#16875b]">WebP.</span>
          <br className="hidden sm:block" /> Make the web faster.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#718078] sm:text-lg">
          Convert PNG and JPEG images to WebP in seconds. Tune the quality, compare file sizes, and download your optimized images.
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface rounded-3xl p-4 sm:p-6">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload PNG or JPEG images"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={`dropzone flex min-h-[210px] flex-col items-center justify-center rounded-2xl px-5 py-6 text-center outline-none ${dragging ? "active" : ""}`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#16875b] shadow-sm">
              <UploadCloud size={27} />
            </div>
            <h2 className="text-lg font-semibold">Drop your images here</h2>
            <p className="mt-1.5 text-sm text-[#718078]">or click to browse from your device</p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#176f4e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125c40]">
              <ImagePlus size={16} /> Choose images
            </span>
            <p className="mt-3 text-xs text-[#8a9991]">PNG or JPG · Up to 10 MB per image · Multiple files supported</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {notice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>
          )}

          {items.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Your images <span className="ml-1 text-sm font-normal text-[#8a9991]">({items.length})</span></h3>
                  <p className="mt-0.5 text-xs text-[#8a9991]">{completed} of {items.length} converted</p>
                </div>
                <button onClick={clearAll} disabled={busy} className="flex items-center gap-1.5 text-xs font-medium text-[#718078] hover:text-red-600">
                  <Trash2 size={14} /> Clear all
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const saved = item.outputSize !== undefined
                    ? item.file.size - item.outputSize
                    : 0;
                  const percent = item.outputSize !== undefined && item.file.size > 0
                    ? Math.round((saved / item.file.size) * 100)
                    : 0;

                  return (
                    <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-[#e8eee9] bg-white p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f1f5f2]">
                          {/* Local object URL preview; never uploaded until Convert is clicked. */}
                          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.file.name}</p>
                          <p className="mt-1 text-xs text-[#8a9991]">{formatBytes(item.file.size)} · {item.file.type === "image/png" ? "PNG" : "JPEG"} · {item.sourceWidth} × {item.sourceHeight}</p>
                          {item.status === "done" ? (
                            <p className="mt-1 text-xs font-medium text-[#16875b]">
                              {formatBytes(item.outputSize ?? 0)} WebP · {item.outputWidth} × {item.outputHeight} · {saved >= 0 ? `${percent}% smaller` : `${Math.abs(percent)}% larger`}
                            </p>
                          ) : item.status === "error" ? (
                            <p className="mt-1 text-xs text-red-600">{item.error}</p>
                          ) : (
                            <p className="mt-1 text-xs text-[#8a9991]">
                              {item.status === "converting" ? "Converting…" : "Ready to convert"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {item.status === "converting" && <LoaderCircle className="animate-spin text-[#16875b]" size={18} />}
                        {item.status === "done" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewItemId(item.id)}
                              aria-label={`Preview ${item.file.name}`}
                              title="Preview"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf6ee] text-[#176f4e] transition hover:bg-[#d9efdf]"
                            >
                              <FileImage size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => download(item)}
                              aria-label={`Download ${item.file.name} as WebP`}
                              title="Download WebP"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#176f4e] text-white transition hover:bg-[#125c40]"
                            >
                              <ArrowDownToLine size={16} />
                            </button>
                          </>
                        )}
                        <button
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() => remove(item.id)}
                          disabled={busy}
                          className="rounded-lg p-2 text-[#9aa79f] hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                onClick={convertAll}
                disabled={!ready || busy}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${allDone ? "bg-[#eaf6ee] text-[#176f4e] opacity-100" : "bg-[#176f4e] text-white hover:bg-[#125c40] disabled:opacity-50"}`}
              >
                {busy ? (
                  <><LoaderCircle size={17} className="animate-spin" /> Converting images…</>
                ) : allDone ? (
                  <><CheckCircle2 size={18} /> Done — all images converted</>
                ) : remainingCount > 0 && completed > 0 ? (
                  <>Convert {remainingCount} remaining {remainingCount === 1 ? "image" : "images"} <ArrowRight size={17} /></>
                ) : remainingCount > 0 ? (
                  <>Convert {remainingCount} {remainingCount === 1 ? "image" : "images"} <ArrowRight size={17} /></>
                ) : (
                  <>All done <CheckCircle2 size={18} /></>
                )}
              </button>
              <p className="mt-2 text-center text-xs text-[#8a9991]">Images are processed one at a time to keep things reliable.</p>
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <div className="surface rounded-3xl p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf6ee] text-[#16875b]"><Sparkles size={17} /></div>
              <div>
                <h3 className="text-sm font-semibold">Conversion settings</h3>
                <p className="text-xs text-[#8a9991]">Fine-tune your output</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <label htmlFor="quality" className="text-sm font-medium">WebP quality</label>
              <span className="rounded-lg bg-[#eef6f0] px-2.5 py-1 text-sm font-semibold text-[#176f4e]">{quality}%</span>
            </div>
            <input
              id="quality"
              className="range mt-4 w-full"
              type="range"
              min="1"
              max="100"
              step="1"
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
            <div className="mt-2 flex justify-between text-[11px] text-[#8a9991]"><span>Smaller file</span><span>Higher quality</span></div>
            <div className="mt-5 rounded-xl bg-[#f5f8f5] p-3">
              <p className="text-xs font-semibold text-[#43534a]">Recommended: 80–85%</p>
              <p className="mt-1 text-xs leading-5 text-[#829087]">A good balance between visual quality and file size for most images.</p>
            </div>
            <div className="my-6 border-t border-[#e8eee9]" />
            <div>
              <div className="flex items-center gap-2">
                <FileImage size={16} className="text-[#16875b]" />
                <h4 className="text-sm font-semibold">Image dimensions</h4>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#8a9991]">Choose the output resolution for converted images.</p>
              <div className="mt-4 space-y-3">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${resizeMode === "original" ? "border-[#176f4e] bg-[#eaf6ee]" : "border-[#e5ebe7] bg-white hover:border-[#b9d6c3]"}`}>
                <input
                  type="radio"
                  name="resize-mode"
                  value="original"
                  checked={resizeMode === "original"}
                  onChange={() => setResizeMode("original")}
                  className="h-4 w-4 accent-[#176f4e]"
                />
                <span className="text-xs font-semibold text-[#43534a]">Original size</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${resizeMode === "custom" ? "border-[#176f4e] bg-[#eaf6ee]" : "border-[#e5ebe7] bg-white hover:border-[#b9d6c3]"}`}>
                <input
                  type="radio"
                  name="resize-mode"
                  value="custom"
                  checked={resizeMode === "custom"}
                  onChange={() => setResizeMode("custom")}
                  className="h-4 w-4 accent-[#176f4e]"
                />
                <span className="text-xs font-semibold text-[#43534a]">Custom size</span>
              </label>
            </div>
              {resizeMode === "custom" && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-[#43534a]">Width (px)
                      <input type="number" min="1" max="12000" inputMode="numeric" value={targetWidth} onChange={(event) => setTargetWidth(event.target.value)} placeholder="Width"
                        className="mt-1.5 w-full rounded-lg border border-[#dce7df] bg-white px-3 py-2.5 text-sm text-[#17221f] outline-none focus:border-[#16875b] focus:ring-2 focus:ring-[#16875b]/10" />
                    </label>
                    <label className="block text-xs font-medium text-[#43534a]">Height (px)
                      <input type="number" min="1" max="12000" inputMode="numeric" value={targetHeight} onChange={(event) => setTargetHeight(event.target.value)} placeholder="Auto"
                        className="mt-1.5 w-full rounded-lg border border-[#dce7df] bg-white px-3 py-2.5 text-sm text-[#17221f] outline-none focus:border-[#16875b] focus:ring-2 focus:ring-[#16875b]/10" />
                    </label>
                  </div>
                  <p className="text-[11px] leading-5 text-[#8a9991]">Leave a dimension empty to calculate it from the original aspect ratio.</p>
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#526158]">
                    <input type="checkbox" checked={keepAspectRatio} onChange={(event) => setKeepAspectRatio(event.target.checked)} className="mt-0.5 accent-[#176f4e]" />
                    <span><span className="font-semibold">Maintain aspect ratio</span><span className="mt-0.5 block text-[#8a9991]">Fit inside the requested dimensions without stretching.</span></span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#526158]">
                    <input type="checkbox" checked={preventUpscaling} onChange={(event) => setPreventUpscaling(event.target.checked)} className="accent-[#176f4e]" />
                    Prevent enlarging smaller images
                  </label>
                  {items.length > 0 && (
                    <div className="rounded-xl bg-[#f5f8f5] p-3">
                      <p className="text-[11px] font-semibold text-[#43534a]">Output size preview</p>
                      <div className="mt-2 space-y-1.5">
                        {items.slice(0, 3).map((item) => {
                          const dimensions = getOutputDimensions(item.sourceWidth, item.sourceHeight, targetWidth, targetHeight, keepAspectRatio, preventUpscaling);
                          return <div key={item.id} className="flex items-center justify-between gap-2 text-[11px] text-[#718078]">
                            <span className="min-w-0 truncate">{item.file.name}</span>
                            <span className="shrink-0 font-medium text-[#176f4e]">{dimensions.width} × {dimensions.height}</span>
                          </div>;
                        })}
                        {items.length > 3 && <p className="pt-1 text-[10px] text-[#8a9991]">And {items.length - 3} more images…</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </aside>
      </section>

      <section className="surface mx-auto mt-5 max-w-5xl rounded-3xl p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Private by design</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-2.5"><ShieldCheck size={17} className="shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">No account or sign-up required.</p></div>
          <div className="flex items-center gap-2.5"><LockKeyhole size={17} className="shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">Files are processed in memory, not saved to an image storage bucket.</p></div>
          <div className="flex items-center gap-2.5"><RefreshCw size={17} className="shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">Your original files stay on your device.</p></div>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-5xl gap-4 border-t border-[#e5ebe7] pt-8 sm:grid-cols-3">
        {[
          { icon: <Zap size={18} />, title: "Fast conversion", body: "Cloud-based processing without a complicated workflow." },
          { icon: <FileImage size={18} />, title: "Smaller images", body: "WebP can help reduce image size while retaining quality." },
          { icon: <LockKeyhole size={18} />, title: "No file storage", body: "No image library, account, or persistent upload storage." },
        ].map((feature) => (
          <div key={feature.title} className="flex gap-3 rounded-2xl p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#16875b] shadow-sm">{feature.icon}</div>
            <div><h3 className="text-sm font-semibold">{feature.title}</h3><p className="mt-1 text-xs leading-5 text-[#829087]">{feature.body}</p></div>
          </div>
        ))}
      </section>
      <section className="mx-auto  mt-10 max-w-5xl px-4 pb-16">
        <div className="rounded-3xl border border-[#e5ebe7] bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Free online WebP converter by ByteLabs
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#718078]">
            WebP Converter makes it easy to convert PNG and JPG images into
            WebP format directly from your browser. Add one image or a batch,
            choose your preferred WebP quality and output dimensions, compare
            file sizes, and download your optimized images.
          </p>
          <h3 className="mt-6 text-base font-semibold">
            Why use WebP Converter?
          </h3>
          <p className="mt-2 text-sm leading-7 text-[#718078]">
            WebP is a modern image format that can provide smaller files than
            PNG or JPEG while maintaining visual quality. Smaller images can
            help websites use less bandwidth and load faster. This free
            WebP converter by ByteLabs requires no account and displays no
            advertisements. Images are processed by our conversion service
            and are not saved to a persistent image-storage bucket.
          </p>
          <h3 className="mt-6 text-base font-semibold">
            Convert PNG and JPG to WebP in three steps
          </h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#718078]">
            <li>Upload or drag and drop your PNG or JPG images.</li>
            <li>Choose the WebP quality that suits your needs.</li>
            <li>Convert and download your WebP images.</li>
          </ol>
          <p className="mt-6 text-xs text-[#8a9991]">
            WebP Converter is an online image utility from ByteLabs.
          </p>
        </div>
      </section>
      {previewItem && previewItem.outputUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102019]/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewItemId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="preview-title" className="text-lg font-semibold text-[#17221f]">Preview converted image</h2>
                <p className="mt-1 max-w-xl truncate text-xs text-[#8a9991]">{previewItem.file.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItemId(null)}
                aria-label="Close image preview"
                className="rounded-lg p-2 text-[#718078] transition hover:bg-[#f1f5f2] hover:text-[#17221f]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#43534a]">Original</h3>
                  <span className="text-xs text-[#8a9991]">{previewItem.sourceWidth} × {previewItem.sourceHeight}</span>
                </div>
                <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-[#e5ebe7] bg-[#f5f8f5] p-2">
                  <img src={previewItem.previewUrl} alt={`Original image: ${previewItem.file.name}`} className="max-h-[48vh] max-w-full object-contain" />
                </div>
                <p className="mt-2 text-xs text-[#718078]">{formatBytes(previewItem.file.size)}</p>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#176f4e]">WebP result</h3>
                  <span className="text-xs text-[#8a9991]">{previewItem.outputWidth} × {previewItem.outputHeight}</span>
                </div>
                <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-[#b9d6c3] bg-[#f5f8f5] p-2">
                  <img src={previewItem.outputUrl} alt={`Converted WebP image: ${previewItem.file.name}`} className="max-h-[48vh] max-w-full object-contain" />
                </div>
                <p className="mt-2 text-xs text-[#718078]">{formatBytes(previewItem.outputSize ?? 0)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#e8eee9] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#718078]">Original files remain unchanged on your device.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPreviewItemId(null)} className="rounded-xl border border-[#dce7df] px-4 py-2.5 text-xs font-semibold text-[#526158] transition hover:bg-[#f5f8f5]">Close</button>
                <button type="button" onClick={() => download(previewItem)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176f4e] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#125c40]">
                  <ArrowDownToLine size={15} /> Download WebP
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="mx-auto max-w-5xl text-center text-xs text-[#9aa79f]">

        <div className="border-gray-200 pt-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Made with <span className="text-red-500">♥</span> by{" "}
          <a
            href="https://bytelabstech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-blue-500 transition-colors"
          >
            ByteLabs
          </a>
        </div>
      </footer>
    </main>
  );
}
