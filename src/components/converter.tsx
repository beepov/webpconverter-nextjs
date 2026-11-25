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

export default function Converter() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(82);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
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

  const addFiles = useCallback((files: FileList | File[]) => {
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
      next.push({
        id: makeId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "ready",
      });
    }

    setItems((current) => [...current, ...next]);
    setNotice(errors.join(" "));
  }, []);

  const updateItem = (id: string, update: Partial<Item>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const convertOne = async (item: Item) => {
    if (!API_URL) throw new Error("Converter API URL is not configured.");

    updateItem(item.id, { status: "converting", error: undefined });

    const response = await fetch(`${API_URL}/convert?quality=${quality}`, {
      method: "POST",
      headers: { "Content-Type": item.file.type, "X-API-Key": process.env.NEXT_PUBLIC_API_KEY ?? "", },
      body: item.file,
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
  };

  const clearAll = () => {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    setItems([]);
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const completed = items.filter((item) => item.status === "done").length;
  const remainingCount = items.filter((item) => item.status === "ready" || item.status === "error").length;
  const ready = remainingCount > 0;
  const allDone = items.length > 0 && completed === items.length;

  return (
    <main className="min-h-screen px-4 pb-16">
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
          Make your images<br className="hidden sm:block" /> <span className="text-[#16875b]">lighter.</span> Keep them beautiful.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#718078] sm:text-lg">
          Convert PNG and JPEG images to WebP in seconds. Tune the quality, compare file sizes, and download your optimized images.
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-[1fr_300px]">
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
            className={`dropzone flex min-h-[250px] flex-col items-center justify-center rounded-2xl px-5 py-9 text-center outline-none ${dragging ? "active" : ""}`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#16875b] shadow-sm">
              <UploadCloud size={27} />
            </div>
            <h2 className="text-lg font-semibold">Drop your images here</h2>
            <p className="mt-1.5 text-sm text-[#718078]">or click to browse from your device</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176f4e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125c40]">
              <ImagePlus size={16} /> Choose images
            </span>
            <p className="mt-4 text-xs text-[#8a9991]">PNG or JPG · Up to 10 MB per image · Multiple files supported</p>
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
                          <p className="mt-1 text-xs text-[#8a9991]">{formatBytes(item.file.size)} · {item.file.type === "image/png" ? "PNG" : "JPEG"}</p>
                          {item.status === "done" ? (
                            <p className="mt-1 text-xs font-medium text-[#16875b]">
                              {formatBytes(item.outputSize ?? 0)} WebP · {saved >= 0 ? `${percent}% smaller` : `${Math.abs(percent)}% larger`}
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
                          <button onClick={() => download(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#eaf6ee] px-3 py-2 text-xs font-semibold text-[#176f4e] hover:bg-[#d9efdf]">
                            <ArrowDownToLine size={14} /> Download
                          </button>
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

        <aside className="space-y-4">
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
          </div>

          <div className="surface rounded-3xl p-5">
            <h3 className="text-sm font-semibold">Private by design</h3>
            <div className="mt-4 space-y-3">
              <div className="flex gap-2.5"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">No account or sign-up required.</p></div>
              <div className="flex gap-2.5"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">Files are processed in memory, not saved to an image storage bucket.</p></div>
              <div className="flex gap-2.5"><RefreshCw size={17} className="mt-0.5 shrink-0 text-[#16875b]" /><p className="text-xs leading-5 text-[#718078]">Your original files stay on your device.</p></div>
            </div>
          </div>
        </aside>
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
            choose your preferred WebP quality, compare the original and
            converted file sizes, and download your optimized images.
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
      <footer className="mx-auto max-w-5xl text-center text-xs text-[#9aa79f]">
        © {new Date().getFullYear()} ByteLabs · WebP Converter
      </footer>
    </main>
  );
}
