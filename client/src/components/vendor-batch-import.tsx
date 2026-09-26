import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, ArrowDownToLine, Check, CheckCircle2, ChevronRight, FileSpreadsheet, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

type Category = { id: number | string; name: string };
type RowState = "ready" | "saving" | "saved" | "failed";
type ListingRow = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  price: string;
  stock: string;
  categoryId: string;
  sku: string;
  originCountry: string;
  photoNames: string[];
  photoFiles: File[];
  state: RowState;
  resultMessage: string;
  source: "csv" | "photo";
  aiSuggested: boolean;
};

const CSV_HEADERS = [
  "name",
  "shortDescription",
  "description",
  "price",
  "stock",
  "categoryId",
  "photoFile",
  "sku",
  "originCountry",
];
const CSV_LIMIT = 256 * 1024;
const CSV_MAX_ROWS = 30;
const EMPTY_ROW = (): ListingRow => ({
  id: crypto.randomUUID(),
  name: "",
  shortDescription: "",
  description: "",
  price: "",
  stock: "",
  categoryId: "",
  sku: "",
  originCountry: "",
  photoNames: [],
  photoFiles: [],
  state: "ready",
  resultMessage: "",
  source: "csv",
  aiSuggested: false,
});

function errorMessage(error: unknown) {
  const message = (error instanceof Error ? error.message : "Something went wrong.").replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // Keep plain-text API errors as returned.
  }
  return message.replace(/^"+|"+$/g, "");
}

function imageFileIssue(file: File) {
  if (file.size > 15 * 1024 * 1024) return `“${file.name}” exceeds the 15 MB image limit.`;
  if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name) ||
      !/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
    return `“${file.name}” must be a JPG, PNG, WEBP, GIF, or AVIF image.`;
  }
  return "";
}

function requiredRowErrors(row: ListingRow, categories: Category[], photoMap: Map<string, File[]>, duplicateNames: Set<string>) {
  const errors: string[] = [];
  if (!row.name.trim()) errors.push("Product name is required.");
  if (!row.shortDescription.trim()) errors.push("Short description is required.");
  if (!row.description.trim()) errors.push("Full description is required.");
  const price = Number(row.price);
  if (!row.price.trim() || !Number.isFinite(price) || price <= 0) errors.push("Enter a price greater than zero.");
  if (!row.stock.trim() || !/^\d+$/.test(row.stock) || Number(row.stock) < 0) errors.push("Stock must be a whole number of zero or more.");
  if (!row.categoryId || !categories.some((category) => String(category.id) === row.categoryId)) errors.push("Choose a valid category.");
  if (row.source === "csv" && row.photoNames.length > 5) errors.push("Attach no more than five photos.");
  for (const name of row.photoNames) {
    if (duplicateNames.has(name)) errors.push(`“${name}” is ambiguous: multiple selected files have this exact filename.`);
    else if (!photoMap.has(name)) errors.push(`Photo “${name}” was not selected. Select a file with that exact filename.`);
  }
  const files = row.source === "csv"
    ? row.photoNames.flatMap((name) => photoMap.get(name) || [])
    : row.photoFiles;
  for (const file of files) {
    const issue = imageFileIssue(file);
    if (issue) errors.push(issue);
  }
  return errors;
}

function CSVDownload() {
  const download = () => {
    const blob = new Blob([`${CSV_HEADERS.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "afrolandx-product-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={download} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4 hover:text-teal-950">
      <ArrowDownToLine className="h-4 w-4" /> Download sample CSV
    </button>
  );
}

export default function VendorBatchImport({ open, onOpenChange, onComplete }: Props) {
  const [mode, setMode] = useState<"csv" | "photo">("csv");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCategoriesLoading(true);
    setCategoriesError("");
    apiRequest("GET", "/api/categories")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
        setCategories(list.filter((item: any) => item && item.id != null && item.name).map((item: any) => ({ id: item.id, name: String(item.name) })));
      })
      .catch((error) => active && setCategoriesError(errorMessage(error)))
      .finally(() => active && setCategoriesLoading(false));
    return () => { active = false; };
  }, [open]);

  const photoMap = useMemo(() => {
    const map = new Map<string, File[]>();
    selectedPhotos.forEach((file) => map.set(file.name, [...(map.get(file.name) || []), file]));
    return map;
  }, [selectedPhotos]);
  const duplicateNames = useMemo(() => new Set(Array.from(photoMap).filter(([, files]) => files.length > 1).map(([name]) => name)), [photoMap]);
  const rowErrors = useMemo(() => new Map(rows.map((row) => [
    row.id,
    row.state === "saved" ? [] : requiredRowErrors(row, categories, photoMap, duplicateNames),
  ])), [rows, categories, photoMap, duplicateNames]);
  const validUnsavedCount = rows.filter((row) => row.state !== "saved" && rowErrors.get(row.id)?.length === 0).length;
  const readyToSubmitCount = rows.filter((row) =>
    row.state !== "saved" && rowErrors.get(row.id)?.length === 0 &&
    (row.source === "csv" ? row.photoNames.length > 0 : row.photoFiles.length > 0)
  ).length;
  const savedCount = rows.filter((row) => row.state === "saved").length;

  const updateRow = (id: string, patch: Partial<ListingRow>) => {
    setRows((current) => current.map((row) => row.id === id && row.state !== "saved" ? { ...row, ...patch, resultMessage: row.state === "failed" ? "" : row.resultMessage, state: row.state === "failed" ? "ready" : row.state } : row));
  };

  const handleCsv = async (file?: File) => {
    setGlobalError("");
    setSaveNotice("");
    setCsvFileName("");
    if (!file) return;
    if (saving || aiRunning || rows.some((row) => row.state === "saved")) {
      setGlobalError("Finish this batch or reset its saved rows before choosing another CSV.");
      return;
    }
    if (file.size > CSV_LIMIT) {
      setGlobalError("This CSV exceeds the 256 KB limit. Choose a smaller file.");
      return;
    }
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    });
    if (result.errors.length) {
      setGlobalError(`Could not read this CSV: ${result.errors[0].message}`);
      return;
    }
    const actualHeaders = result.meta.fields || [];
    const missing = CSV_HEADERS.filter((header) => !actualHeaders.includes(header));
    const unknown = actualHeaders.filter((header) => !CSV_HEADERS.includes(header));
    if (missing.length || unknown.length) {
      setGlobalError([
        missing.length ? `Missing columns: ${missing.join(", ")}.` : "",
        unknown.length ? `Unexpected columns: ${unknown.join(", ")}.` : "",
      ].filter(Boolean).join(" "));
      return;
    }
    if (result.data.length > CSV_MAX_ROWS) {
      setGlobalError(`This file has ${result.data.length} rows. Imports are limited to ${CSV_MAX_ROWS} products at a time.`);
      return;
    }
    if (!result.data.length) {
      setGlobalError("No product rows found. Add at least one row below the header.");
      return;
    }
    const nextRows = result.data.map((record) => ({
      ...EMPTY_ROW(),
      source: "csv" as const,
      name: String(record.name || "").trim(),
      shortDescription: String(record.shortDescription || "").trim(),
      description: String(record.description || "").trim(),
      price: String(record.price || "").trim(),
      stock: String(record.stock || "").trim(),
      categoryId: String(record.categoryId || "").trim(),
      sku: String(record.sku || "").trim(),
      originCountry: String(record.originCountry || "").trim(),
      photoNames: String(record.photoFile || "").split("|").map((name) => name.trim()).filter(Boolean),
    }));
    setRows(nextRows);
    setCsvFileName(file.name);
    setSelectedPhotos([]);
  };

  const handlePhotoSelection = (files: File[]) => {
    setGlobalError("");
    setSaveNotice("");
    if (saving || aiRunning || rows.some((row) => row.state === "saved")) {
      setGlobalError("Finish this batch or reset its saved rows before choosing more photos.");
      return;
    }
    if (files.length > 10) {
      setGlobalError("Choose no more than 10 photos at a time.");
      return;
    }
    setSelectedPhotos(files);
    setRows(files.map((file) => ({
      ...EMPTY_ROW(),
      source: "photo",
      photoFiles: [file],
      photoNames: [file.name],
    })));
  };

  const generateSuggestions = async () => {
    const pending = rows.filter((row) => row.source === "photo" && !row.aiSuggested && row.state !== "saved");
    if (!pending.length) return;
    setAiRunning(true);
    setGlobalError("");
    for (const row of pending) {
      const image = row.photoFiles[0];
      if (!image) continue;
      try {
        const issue = imageFileIssue(image);
        if (issue) throw new Error(issue);
        if (typeof createImageBitmap === "function") {
          const bitmap = await createImageBitmap(image);
          bitmap.close();
        }
        const body = new FormData();
        body.append("image", image);
        const response = await apiRequest("POST", "/api/products/ai-suggest-listing", body);
        const suggestion = await response.json();
        setRows((current) => current.map((item) => item.id === row.id ? {
          ...item,
          name: item.name || String(suggestion.title || suggestion.name || ""),
          shortDescription: item.shortDescription || String(suggestion.shortDescription || ""),
          description: item.description || String(suggestion.description || ""),
          categoryId: item.categoryId || (suggestion.categoryId == null ? "" : String(suggestion.categoryId)),
          aiSuggested: true,
          resultMessage: "Suggestion ready. Review and complete price and stock before saving.",
          state: "ready",
        } : item));
      } catch (error) {
        setRows((current) => current.map((item) => item.id === row.id ? {
          ...item,
          aiSuggested: false,
          state: "failed",
          resultMessage: `Suggestion failed: ${errorMessage(error)}`,
        } : item));
      }
    }
    setAiRunning(false);
  };

  const saveRows = async (status: "draft" | "pending") => {
    if (saving || categoriesLoading) return;
    setSaveNotice("");
    setGlobalError("");
    const unsavedRows = rows.filter((row) => row.state !== "saved" && row.state !== "saving");
    const invalidCount = unsavedRows.filter((row) => (rowErrors.get(row.id)?.length || 0) > 0).length;
    const validRows = unsavedRows.filter((row) => (rowErrors.get(row.id)?.length || 0) === 0);
    const missingImage = status === "pending" ? validRows.filter((row) =>
      row.source === "csv" ? row.photoNames.length === 0 : row.photoFiles.length === 0
    ) : [];
    if (missingImage.length) {
      const missingIds = new Set(missingImage.map((row) => row.id));
      setRows((current) => current.map((row) => missingIds.has(row.id) ? {
        ...row, state: "failed", resultMessage: "Add a product photo before submitting, or save this listing as a draft.",
      } : row));
    }
    const candidates = validRows.filter((row) => !missingImage.includes(row));
    if (!candidates.length) {
      setGlobalError(unsavedRows.length
        ? `${invalidCount + missingImage.length} row${invalidCount + missingImage.length === 1 ? "" : "s"} need attention. Fix the listed issues before saving.`
        : "There are no unsaved product rows to submit.");
      return;
    }
    setSaving(true);
    let successes = 0;
    for (const row of candidates) {
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, state: "saving", resultMessage: "Saving…" } : item));
      try {
        const form = new FormData();
        form.set("name", row.name.trim());
        form.set("shortDescription", row.shortDescription.trim());
        form.set("description", row.description.trim());
        form.set("price", row.price.trim());
        form.set("stock", row.stock.trim());
        form.set("categoryId", row.categoryId);
        form.set("status", status);
        form.set("clientImportKey", row.id);
        if (row.sku.trim()) form.set("sku", row.sku.trim());
        if (row.originCountry.trim()) form.set("originCountry", row.originCountry.trim());
        const images = row.source === "csv"
          ? row.photoNames.flatMap((name) => photoMap.get(name) || [])
          : row.photoFiles;
        images.forEach((image) => form.append("images", image));
        await apiRequest("POST", "/api/products", form);
        successes += 1;
        setRows((current) => current.map((item) => item.id === row.id ? {
          ...item,
          state: "saved",
          resultMessage: status === "draft" ? "Draft saved successfully." : "Submitted for review successfully.",
        } : item));
      } catch (error) {
        setRows((current) => current.map((item) => item.id === row.id ? {
          ...item,
          state: "failed",
          resultMessage: `Save failed: ${errorMessage(error)}`,
        } : item));
      }
    }
    setSaving(false);
    if (successes > 0) {
      const skippedCount = invalidCount + missingImage.length;
      setSaveNotice(`${successes} product${successes === 1 ? "" : "s"} saved. Successful rows are protected from duplicate submission.${skippedCount ? ` ${skippedCount} incomplete row${skippedCount === 1 ? " remains" : "s remain"} and was skipped.` : ""}`);
      onComplete();
    } else {
      setGlobalError("No products were saved. Review the row-level messages and try again.");
    }
  };

  const reset = () => {
    setRows([]);
    setCsvFileName("");
    setSelectedPhotos([]);
    setGlobalError("");
    setSaveNotice("");
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving && !aiRunning) onOpenChange(nextOpen); }}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-2xl border border-[#d7e2d8] bg-[#fbfaf5] p-0 text-[#19352f] shadow-[0_28px_90px_rgba(20,50,41,0.24)] sm:w-[calc(100%-2rem)]">
        <div className="flex max-h-[94dvh] flex-col">
          <div className="border-b border-[#dbe5db] bg-[#eef4e9] px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
            <DialogHeader className="pr-8 text-left">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#66816e]">
                <span className="h-px w-7 bg-[#c4d3bf]" /> Afrolandx vendor tools
              </div>
              <DialogTitle className="font-serif text-3xl font-medium tracking-[-0.04em] text-[#19352f] sm:text-[2.45rem]">
                Batch product listings
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-[#587066]">
                Prepare a set of products, review every detail, then save drafts or send them for review. Nothing is submitted until you choose.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-[#e1eadf] p-1.5 sm:max-w-[440px]" role="tablist" aria-label="Import method">
              <button type="button" role="tab" aria-selected={mode === "csv"} disabled={saving || aiRunning} onClick={() => { setMode("csv"); setGlobalError(""); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${mode === "csv" ? "bg-[#fbfaf5] text-[#173b32] shadow-sm" : "text-[#62786d] hover:text-[#173b32]"}`}>
                <FileSpreadsheet className="h-4 w-4" /> CSV list
              </button>
              <button type="button" role="tab" aria-selected={mode === "photo"} disabled={saving || aiRunning} onClick={() => { setMode("photo"); setGlobalError(""); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${mode === "photo" ? "bg-[#fbfaf5] text-[#173b32] shadow-sm" : "text-[#62786d] hover:text-[#173b32]"}`}>
                <ImagePlus className="h-4 w-4" /> Photo drafts
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {mode === "csv" ? (
              <section aria-label="CSV import" className="rounded-xl border border-[#dce5dc] bg-white/70 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-semibold text-[#23463b]">Bring in a product sheet</h3>
                    <p className="mt-1 max-w-xl text-sm leading-5 text-[#708279]">CSV only, up to 256 KB and 30 product rows. Enter prices in Nigerian naira (₦) and use a category ID from the live list.</p>
                  </div>
                  <CSVDownload />
                </div>
                <input ref={csvInputRef} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Choose CSV file" disabled={saving || aiRunning}
                  onChange={(event) => { void handleCsv(event.currentTarget.files?.[0]); }} />
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-[#b9cbbd] bg-[#f6f8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e7efe3] text-[#48715a]"><Upload className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#315343]">{csvFileName || "Choose a CSV file"}</p>
                      <p className="text-xs text-[#78877e]">Required columns are listed in the template.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => csvInputRef.current?.click()} className="min-h-10 shrink-0 rounded-lg bg-[#245b47] px-4 text-sm font-semibold text-white transition hover:bg-[#194a39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#749b78] focus-visible:ring-offset-2">
                    Select CSV
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#78877e]">For photos, choose image files in this wizard and enter their exact filenames in <code className="rounded bg-[#edf1e9] px-1 py-0.5 text-[#42634f]">photoFile</code>. Separate multiple filenames with |.</p>
                {categories.length > 0 && <details className="mt-3 text-xs text-[#587066]">
                  <summary className="cursor-pointer font-semibold">Category IDs for your spreadsheet</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((category) => <span key={category.id} className="rounded border border-[#dce5d9] bg-white px-2 py-1">{category.name}: {category.id}</span>)}
                  </div>
                </details>}
                <p className="mt-2 text-xs text-[#78877e]">Rows without photos can be saved as drafts. Add a photo before submitting them for approval.</p>
                <input ref={photoInputRef} className="sr-only" type="file" accept="image/*" multiple aria-label="Choose product photos" disabled={saving || aiRunning}
                  onChange={(event) => setSelectedPhotos(Array.from(event.currentTarget.files || []))} />
                {rows.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-[#e7ece5] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-[#63766b]">{selectedPhotos.length} image file{selectedPhotos.length === 1 ? "" : "s"} selected</span>
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="self-start text-xs font-semibold text-teal-800 underline underline-offset-4">Choose matching image files</button>
                  </div>
                )}
              </section>
            ) : (
              <section aria-label="Photo listing drafts" className="rounded-xl border border-[#dce5dc] bg-white/70 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e7efe3] text-[#48715a]"><Sparkles className="h-4 w-4" /></span>
                  <div>
                    <h3 className="font-semibold text-[#23463b]">Start with product photos</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-[#708279]">Select up to 10 photos. On your explicit request, Afrolandx will suggest listing wording and a category one image at a time. Price and stock remain yours to enter.</p>
                  </div>
                </div>
                <input ref={photoInputRef} className="sr-only" type="file" accept="image/*" multiple aria-label="Choose up to ten product photos" disabled={saving || aiRunning}
                  onChange={(event) => handlePhotoSelection(Array.from(event.currentTarget.files || []))} />
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-[#b9cbbd] bg-[#f6f8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-[#62766a]">{rows.length ? `${rows.length} photo${rows.length === 1 ? "" : "s"} selected` : "No product photos selected"}</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="min-h-10 rounded-lg border border-[#c6d5c7] bg-white px-4 text-sm font-semibold text-[#315343] hover:bg-[#f7faf5]">
                      Select photos
                    </button>
                    <button type="button" disabled={!rows.some((row) => !row.aiSuggested) || aiRunning} onClick={() => void generateSuggestions()}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#245b47] px-4 text-sm font-semibold text-white transition hover:bg-[#194a39] disabled:cursor-not-allowed disabled:opacity-45">
                      {aiRunning ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Preparing suggestions</> : <><Sparkles className="h-4 w-4" /> Suggest listing details</>}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#78877e]">AI suggestions do not set price, stock, origin country, or material. Confirm every field before saving.</p>
              </section>
            )}

            {categoriesError && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[#e7c5b8] bg-[#fff4ed] p-3 text-sm text-[#874e39]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Could not load categories: {categoriesError} <button type="button" className="ml-1 font-semibold underline" onClick={() => { setCategoriesError(""); setCategoriesLoading(true); apiRequest("GET", "/api/categories").then((r) => r.json()).then((data) => setCategories(Array.isArray(data) ? data : [])).catch((e) => setCategoriesError(errorMessage(e))).finally(() => setCategoriesLoading(false)); }}>Retry</button></span>
              </div>
            )}
            {categoriesLoading && <div className="mt-4 h-12 animate-pulse rounded-lg bg-[#e8eee5]" aria-label="Loading categories" />}
            {categories.length === 0 && !categoriesLoading && !categoriesError && <p className="mt-4 rounded-lg bg-[#fff5e9] px-3 py-2 text-sm text-[#795a36]">No categories are available yet. Try again after categories have been configured.</p>}
            {globalError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[#e7c5b8] bg-[#fff4ed] p-3 text-sm text-[#874e39]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{globalError}</div>}
            {saveNotice && <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-[#bfd8c2] bg-[#eff7ed] p-3 text-sm text-[#315d40]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{saveNotice}</div>}

            {rows.length > 0 && (
              <section className="mt-6" aria-label="Product review">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-2xl tracking-[-0.03em] text-[#193d32]">Review each listing</h3>
                      <span className="rounded-full bg-[#e5ede2] px-2.5 py-1 text-xs font-semibold text-[#4a6854]">{rows.length} rows</span>
                    </div>
                    <p className="mt-1 text-xs text-[#77867d]">{savedCount} saved · {validUnsavedCount} ready to save</p>
                  </div>
                  <button type="button" disabled={saving || aiRunning} onClick={reset} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[#65786d] hover:bg-[#edf1e9] disabled:opacity-40">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset rows
                  </button>
                </div>
                <div className="space-y-3">
                  {rows.map((row, index) => {
                    const errors = rowErrors.get(row.id) || [];
                    const resolvedFiles = row.source === "csv" ? row.photoNames.flatMap((name) => photoMap.get(name) || []) : row.photoFiles;
                    const locked = row.state === "saved" || saving;
                    return (
                      <article key={row.id} className={`rounded-xl border bg-white/80 p-4 sm:p-5 ${row.state === "saved" ? "border-[#b9d6bf]" : errors.length ? "border-[#e6d4bd]" : "border-[#dce5dc]"}`}>
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eaf0e6] text-xs font-bold text-[#456550]">{String(index + 1).padStart(2, "0")}</span>
                            <span className="text-sm font-semibold text-[#355342]">{row.name.trim() || (row.source === "photo" ? row.photoFiles[0]?.name : "Untitled product")}</span>
                          </div>
                          {row.state === "saved" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#39724a]"><Check className="h-4 w-4" /> Saved</span>
                            : row.state === "saving" ? <span className="inline-flex items-center gap-1 text-xs text-[#60766a]"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving</span>
                              : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Product name" value={row.name} onChange={(value) => updateRow(row.id, { name: value })} disabled={locked} />
                          <label className="block text-xs font-semibold text-[#587066]">Category
                            <select value={row.categoryId} onChange={(event) => updateRow(row.id, { categoryId: event.target.value })} disabled={locked || categoriesLoading || !categories.length}
                              className="mt-1.5 h-10 w-full rounded-lg border border-[#d6e0d5] bg-[#fbfcf8] px-3 text-sm font-normal text-[#254438] outline-none focus:border-[#6d987b] focus:ring-2 focus:ring-[#c6dcc8] disabled:opacity-60">
                              <option value="">Select a category</option>
                              {categories.map((category) => <option key={category.id} value={String(category.id)}>{category.name}</option>)}
                            </select>
                          </label>
                          <Field label="Short description" value={row.shortDescription} onChange={(value) => updateRow(row.id, { shortDescription: value })} disabled={locked} />
                          <div className="grid grid-cols-2 gap-3">
                             <Field label="Price (₦)" type="number" min="0.01" step="0.01" value={row.price} onChange={(value) => updateRow(row.id, { price: value })} disabled={locked} placeholder="Required" />
                            <Field label="Stock" type="number" min="0" step="1" value={row.stock} onChange={(value) => updateRow(row.id, { stock: value })} disabled={locked} placeholder="Required" />
                          </div>
                          <label className="block text-xs font-semibold text-[#587066] sm:col-span-2">Full description
                            <textarea value={row.description} onChange={(event) => updateRow(row.id, { description: event.target.value })} disabled={locked} rows={3}
                              className="mt-1.5 w-full resize-y rounded-lg border border-[#d6e0d5] bg-[#fbfcf8] px-3 py-2.5 text-sm font-normal leading-5 text-[#254438] outline-none focus:border-[#6d987b] focus:ring-2 focus:ring-[#c6dcc8] disabled:opacity-60" />
                          </label>
                          <Field label="SKU (optional)" value={row.sku} onChange={(value) => updateRow(row.id, { sku: value })} disabled={locked} />
                          <Field label="Origin country (optional)" value={row.originCountry} onChange={(value) => updateRow(row.id, { originCountry: value })} disabled={locked} />
                        </div>
                        <div className="mt-3 rounded-lg bg-[#f3f6ef] px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#587066]">Product photos</span>
                            <span className="text-[11px] text-[#849187]">{resolvedFiles.length} attached</span>
                          </div>
                          {resolvedFiles.length ? <div className="mt-1.5 flex flex-wrap gap-1.5">{resolvedFiles.map((file, photoIndex) => <span key={`${file.name}-${photoIndex}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#dce5d9] bg-white px-2 py-1 text-xs text-[#53705d]"><ImagePlus className="h-3 w-3 shrink-0" /><span className="truncate">{file.name}</span></span>)}</div>
                            : <p className="mt-1 text-xs text-[#8b7b61]">No image assigned. This row will be saved without an image.</p>}
                          {row.source === "csv" && row.photoNames.length > 0 && row.photoNames.length <= 5 && (
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#718277]">
                              {row.photoNames.map((name, photoIndex) => <span key={`${name}-${photoIndex}`} className="inline-flex items-center gap-1"><ChevronRight className="h-3 w-3" />{name}{photoMap.has(name) && !duplicateNames.has(name) ? " matched" : " not matched"}</span>)}
                            </div>
                          )}
                          {row.source === "csv" && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="text-xs font-semibold text-[#587066]" htmlFor={`assign-photo-${row.id}`}>Assign a selected photo</label>
                              <select id={`assign-photo-${row.id}`} value="" disabled={locked || row.photoNames.length >= 5 || selectedPhotos.length === 0}
                                onChange={(event) => {
                                  const name = event.currentTarget.value;
                                  if (name && !row.photoNames.includes(name)) updateRow(row.id, { photoNames: [...row.photoNames, name] });
                                }}
                                className="h-9 max-w-full rounded-md border border-[#d6e0d5] bg-white px-2 text-xs text-[#254438] disabled:opacity-50">
                                <option value="">Choose a file</option>
                                {selectedPhotos.filter((file) => !row.photoNames.includes(file.name)).map((file, i) =>
                                  <option key={`${file.name}-${i}`} value={file.name}>{file.name}</option>)}
                              </select>
                              {row.photoNames.map((name, i) => (
                                <button key={`${name}-${i}`} type="button" disabled={locked} onClick={() => updateRow(row.id, { photoNames: row.photoNames.filter((_, index) => index !== i) })}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#d6e0d5] bg-white px-2 text-xs text-[#587066] disabled:opacity-50"
                                  aria-label={`Remove ${name} from ${row.name || `row ${index + 1}`}`}>
                                  {name} <X className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {errors.length > 0 && row.state !== "saved" && (
                          <div className="mt-3 rounded-lg border border-[#efddc5] bg-[#fff9f0] px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-[#8a6236]"><AlertCircle className="h-3.5 w-3.5" /> Needs attention</p>
                            <ul className="mt-1 space-y-0.5 pl-5 text-xs leading-5 text-[#806746]">{errors.map((error, errorIndex) => <li key={`${error}-${errorIndex}`} className="list-disc">{error}</li>)}</ul>
                          </div>
                        )}
                        {row.resultMessage && <p role={row.state === "failed" ? "alert" : "status"} className={`mt-3 flex items-start gap-1.5 text-xs leading-5 ${row.state === "failed" ? "text-[#995743]" : row.state === "saved" ? "text-[#39724a]" : "text-[#64786c]"}`}>
                          {row.state === "failed" ? <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : row.state === "saved" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}{row.resultMessage}
                        </p>}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <footer className="flex flex-col gap-3 border-t border-[#dbe5db] bg-[#f5f6ef] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs leading-5 text-[#718177]">{rows.length ? "Saved listings remain here until you reset. Failed rows can be corrected and retried." : "Prepare listings in a CSV or start from product photos."}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button type="button" disabled={saving || aiRunning} onClick={() => onOpenChange(false)} className="min-h-11 rounded-lg border border-[#cbd8cc] bg-white px-4 text-sm font-semibold text-[#466354] hover:bg-[#f8faf6] disabled:opacity-45">Close</button>
              <button type="button" disabled={!validUnsavedCount || saving || aiRunning || categoriesLoading} onClick={() => void saveRows("draft")}
                className="min-h-11 rounded-lg border border-[#b7cdb9] bg-[#e7efe4] px-4 text-sm font-semibold text-[#315b41] hover:bg-[#dce9d8] disabled:cursor-not-allowed disabled:opacity-45">
                Save drafts
              </button>
              <button type="button" disabled={!readyToSubmitCount || saving || aiRunning || categoriesLoading} onClick={() => void saveRows("pending")}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#245b47] px-5 text-sm font-semibold text-white hover:bg-[#194a39] disabled:cursor-not-allowed disabled:opacity-45 sm:col-span-1">
                {saving ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving rows</> : <>Submit for review <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, disabled, type = "text", min, step, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-[#587066]">{label}
      <input type={type} min={min} step={step} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-[#d6e0d5] bg-[#fbfcf8] px-3 text-sm font-normal text-[#254438] outline-none placeholder:text-[#a0aaa1] focus:border-[#6d987b] focus:ring-2 focus:ring-[#c6dcc8] disabled:opacity-60" />
    </label>
  );
}