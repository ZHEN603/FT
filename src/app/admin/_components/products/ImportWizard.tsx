"use client";

import { CheckCircle2, ChevronRight, FileSpreadsheet, Upload, X, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { FtSelect } from "../shared/FtSelect";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

// ── Field definitions ─────────────────────────────────────────────────────────

type FieldKey =
  | "sku" | "name" | "nameEn" | "categoryName" | "price" | "moq"
  | "stock" | "stockWarning" | "material" | "size" | "weightKg"
  | "volumeM3" | "supplier" | "sourceUrl" | "image";

const FIELDS: Array<{ key: FieldKey; label: string; required?: boolean }> = [
  { key: "sku",          label: "SKU",            required: true },
  { key: "name",         label: "产品名称（中文）", required: true },
  { key: "nameEn",       label: "产品名称（英文）" },
  { key: "categoryName", label: "分类名称" },
  { key: "price",        label: "价格（USD）" },
  { key: "moq",          label: "MOQ 最小起订" },
  { key: "stock",        label: "库存数量" },
  { key: "stockWarning", label: "库存预警值" },
  { key: "material",     label: "材料" },
  { key: "size",         label: "规格 / 尺寸" },
  { key: "weightKg",     label: "重量（kg）" },
  { key: "volumeM3",     label: "体积（m³）" },
  { key: "supplier",     label: "供应商" },
  { key: "sourceUrl",    label: "来源链接" },
  { key: "image",        label: "主图 URL" },
];

// Auto-match heuristics: common column name patterns → field key
const AUTO_PATTERNS: Array<{ patterns: string[]; key: FieldKey }> = [
  { key: "sku",          patterns: ["sku", "编号", "货号", "商品编号", "产品编号", "item"] },
  { key: "name",         patterns: ["名称", "产品名", "商品名", "中文名", "name"] },
  { key: "nameEn",       patterns: ["英文名", "english", "name_en", "name en"] },
  { key: "categoryName", patterns: ["分类", "category", "类别", "品类"] },
  { key: "price",        patterns: ["价格", "price", "单价", "含税价", "cost"] },
  { key: "moq",          patterns: ["moq", "起订量", "最小订量", "minimum"] },
  { key: "stock",        patterns: ["库存", "stock", "inventory", "数量", "qty"] },
  { key: "material",     patterns: ["材料", "材质", "material"] },
  { key: "size",         patterns: ["规格", "尺寸", "size", "spec", "型号"] },
  { key: "weightKg",     patterns: ["重量", "weight", "kg", "毛重", "净重"] },
  { key: "volumeM3",     patterns: ["体积", "volume", "cbm", "m3"] },
  { key: "supplier",     patterns: ["供应商", "supplier", "厂家", "vendor"] },
  { key: "sourceUrl",    patterns: ["链接", "url", "网址", "source"] },
  { key: "image",        patterns: ["图片", "image", "pic", "主图", "photo"] },
];

function autoMatch(header: string): FieldKey | "" {
  const h = header.toLowerCase().replace(/[\s_-]/g, "");
  for (const { key, patterns } of AUTO_PATTERNS) {
    if (patterns.some((p) => h.includes(p.toLowerCase().replace(/[\s_-]/g, "")))) return key;
  }
  return "";
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

type ParsedFile = { headers: string[]; rows: Record<string, string>[] };

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): ParsedFile {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
  return { headers, rows };
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
  if (!raw.length) return { headers: [], rows: [] };
  const headers = raw[0].map(String);
  const rows = raw.slice(1).map((r) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = String(r[i] ?? ""); });
    return row;
  });
  return { headers, rows };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "upload" | "mapping" | "preview" | "result";
type Mapping = Record<string, FieldKey | "">;   // fileCol → field

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [draggingOver, setDraggingOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ───────────────────────────────────────────────────────────

  async function loadFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    let data: ParsedFile;
    if (ext === "csv") {
      const text = await file.text();
      data = parseCsv(text);
    } else if (ext === "xlsx" || ext === "xls") {
      data = await parseXlsx(file);
    } else {
      alert("请上传 .xlsx 或 .csv 文件");
      return;
    }
    if (!data.headers.length) { alert("文件为空或格式错误"); return; }

    const auto: Mapping = {};
    data.headers.forEach((h) => { auto[h] = autoMatch(h); });
    setParsed(data);
    setMapping(auto);
    setStep("mapping");
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void loadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  // ── Mapping validation ──────────────────────────────────────────────────────

  const requiredKeys = FIELDS.filter((f) => f.required).map((f) => f.key);
  const mappedValues = Object.values(mapping).filter(Boolean) as FieldKey[];
  const missingRequired = requiredKeys.filter((k) => !mappedValues.includes(k));

  function changeMapping(header: string, newField: FieldKey | "") {
    setMapping((prev) => {
      const next = { ...prev };
      // Clear any other column that was using this field
      if (newField) {
        Object.keys(next).forEach((col) => {
          if (col !== header && next[col] === newField) next[col] = "";
        });
      }
      next[header] = newField;
      return next;
    });
  }

  // ── Preview rows ────────────────────────────────────────────────────────────

  function buildMappedRow(rawRow: Record<string, string>): Record<FieldKey, string> {
    const out = {} as Record<FieldKey, string>;
    Object.entries(mapping).forEach(([fileCol, fieldKey]) => {
      if (fieldKey) out[fieldKey] = rawRow[fileCol] ?? "";
    });
    return out;
  }

  const previewRows = (parsed?.rows ?? []).slice(0, 8);
  const mappedFields = FIELDS.filter((f) => mappedValues.includes(f.key));

  // ── Import ──────────────────────────────────────────────────────────────────

  async function runImport() {
    if (!parsed) return;
    setImporting(true);
    setStep("result");
    const rows = parsed.rows.map(buildMappedRow);
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json() as ImportResult;
      setResult(data);
    } catch {
      setResult({ imported: 0, skipped: parsed.rows.length, errors: [{ row: 0, message: "网络错误，请重试" }] });
    } finally {
      setImporting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const stepLabels: Step[] = ["upload", "mapping", "preview", "result"];
  const stepNames = ["上传文件", "字段映射", "数据预览", "导入结果"];
  const stepIdx = stepLabels.indexOf(step);

  return (
    <AdminModalBackdrop>
      <div className="import-wizard">
        {/* Header */}
        <div className="admin-modal-titlebar">
          <h2>导入产品数据</h2>
          <button type="button" className="admin-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Step indicator */}
        <div className="import-steps">
          {stepNames.map((label, i) => (
            <div key={i} className={`import-step${i === stepIdx ? " active" : i < stepIdx ? " done" : ""}`}>
              <div className="import-step-dot">{i < stepIdx ? <CheckCircle2 size={14} /> : i + 1}</div>
              <span>{label}</span>
              {i < stepNames.length - 1 && <ChevronRight size={14} className="import-step-arrow" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="import-body">

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <div className="import-upload-zone">
              <div
                className={`import-drop${draggingOver ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet size={48} className="import-drop-icon" />
                <p className="import-drop-title">拖拽文件到此处，或点击选择</p>
                <p className="import-drop-hint">支持 .xlsx 和 .csv 格式</p>
                <button type="button" className="admin-primary" style={{ marginTop: 16 }}>
                  <Upload size={16} /> 选择文件
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={onFileInput}
              />
              <div className="import-tip">
                <strong>提示：</strong>第一行应为列标题，之后每行为一条产品数据。
                必填字段：SKU、产品名称（中文）。
              </div>
            </div>
          )}

          {/* ── STEP 2: Mapping ── */}
          {step === "mapping" && parsed && (
            <div className="import-mapping">
              <p className="import-mapping-info">
                已读取 <strong>{parsed.rows.length}</strong> 行数据，共 <strong>{parsed.headers.length}</strong> 列。
                请为每个文件列选择对应的产品字段。
              </p>
              {missingRequired.length > 0 && (
                <div className="import-warn">
                  <XCircle size={14} />
                  {" "}必填字段未映射：{missingRequired.map((k) => FIELDS.find((f) => f.key === k)?.label).join("、")}
                </div>
              )}
              <table className="import-map-table">
                <thead>
                  <tr>
                    <th>文件列名</th>
                    <th>示例数据（前2行）</th>
                    <th>映射到产品字段</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header) => (
                    <tr key={header}>
                      <td className="map-col-name">{header}</td>
                      <td className="map-col-sample">
                        {[parsed.rows[0]?.[header], parsed.rows[1]?.[header]]
                          .filter(Boolean)
                          .map((v, i) => <span key={i}>{v}</span>)}
                      </td>
                      <td>
                        <FtSelect
                          value={mapping[header] ?? ""}
                          options={[{ value: "", label: "-- 忽略此列 --" }, ...FIELDS.map((f) => ({ value: f.key, label: `${f.required ? "* " : ""}${f.label}` }))]}
                          onChange={(value) => changeMapping(header, value as FieldKey | "")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === "preview" && parsed && (
            <div className="import-preview">
              <p className="import-mapping-info">
                即将导入 <strong>{parsed.rows.length}</strong> 条产品。以下为前 {previewRows.length} 行预览：
              </p>
              <div className="import-preview-scroll">
                <table className="admin-table import-preview-table">
                  <thead>
                    <tr>
                      {mappedFields.map((f) => (
                        <th key={f.key}>{f.label}{f.required && <span className="req-star"> *</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((raw, ri) => {
                      const row = buildMappedRow(raw);
                      return (
                        <tr key={ri}>
                          {mappedFields.map((f) => (
                            <td key={f.key} className={f.required && !row[f.key] ? "cell-error" : ""}>
                              {row[f.key] || <span className="text-muted">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP 4: Result ── */}
          {step === "result" && (
            <div className="import-result">
              {importing ? (
                <div className="import-loading">
                  <div className="import-spinner" />
                  <p>正在导入，请稍候...</p>
                </div>
              ) : result ? (
                <>
                  <div className={`import-result-summary ${result.imported > 0 ? "success" : "fail"}`}>
                    {result.imported > 0
                      ? <CheckCircle2 size={36} />
                      : <XCircle size={36} />}
                    <div>
                      <strong>成功导入 {result.imported} 条</strong>
                      {result.skipped > 0 && <span>，跳过 {result.skipped} 条</span>}
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="import-error-list">
                      <h4>跳过详情</h4>
                      {result.errors.slice(0, 30).map((e, i) => (
                        <div key={i} className="import-error-row">
                          <span className="import-error-row-num">第 {e.row} 行</span>
                          <span>{e.message}</span>
                        </div>
                      ))}
                      {result.errors.length > 30 && (
                        <p className="text-muted">…还有 {result.errors.length - 30} 条</p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="admin-modal-footer">
          {step === "upload" && (
            <button type="button" className="admin-light" onClick={onClose}>取消</button>
          )}
          {step === "mapping" && (
            <>
              <button type="button" className="admin-light" onClick={() => setStep("upload")}>上一步</button>
              <button
                type="button"
                className="admin-primary"
                disabled={missingRequired.length > 0}
                onClick={() => setStep("preview")}
              >
                下一步：预览
              </button>
            </>
          )}
          {step === "preview" && (
            <>
              <button type="button" className="admin-light" onClick={() => setStep("mapping")}>上一步</button>
              <button type="button" className="admin-primary" onClick={() => void runImport()}>
                开始导入 {parsed?.rows.length} 条
              </button>
            </>
          )}
          {step === "result" && !importing && (
            <>
              {result && result.imported === 0 && (
                <button type="button" className="admin-light" onClick={() => setStep("upload")}>重新上传</button>
              )}
              <button
                type="button"
                className="admin-primary"
                onClick={() => { if (result?.imported) onDone(); else onClose(); }}
              >
                {result?.imported ? "完成并刷新" : "关闭"}
              </button>
            </>
          )}
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
