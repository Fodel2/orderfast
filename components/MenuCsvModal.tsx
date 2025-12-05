import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { findBestMatch } from 'string-similarity';

type CsvMode = 'import' | 'bulk';

type EditableRow = {
  id: string;
  itemId?: string;
  externalKey?: string;
  name: string;
  price: string;
  category: string;
  description: string;
  tags: string;
  errors: Partial<Record<'name' | 'price' | 'category' | 'tags', string>>;
  suggestion?: string | null;
};

type RowError = { rowIndex: number; reason: string };

type BulkPreview = {
  willCreate: number;
  willUpdate: number;
  willArchive: number;
};

interface MenuCsvModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: number | null;
  categories: any[];
  items: any[];
  onImported: (message?: string) => void;
}

const TAG_MAP: Record<string, 'vegan' | 'vegetarian' | '18_plus'> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  '18_plus': '18_plus',
  '18+': '18_plus',
  '18-plus': '18_plus',
};

const tagLabels: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  '18_plus': '18+',
};

const ALLOWED_TAGS = Object.keys(TAG_MAP);

const normalizeTag = (input: string) => {
  const lowered = input.trim().toLowerCase();
  const normalized = lowered.replace(/\s+/g, '_').replace(/-/g, '_');
  return TAG_MAP[normalized] || TAG_MAP[lowered] || normalized;
};

function createRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function extractCsvRows(rawRows: any[], items: any[]): EditableRow[] {
  return rawRows
    .filter((r) => Object.values(r || {}).some((v) => v !== undefined && v !== null && `${v}`.trim() !== ''))
    .map((r) => {
      const baseName = r.name ?? r.Name ?? '';
      const matchById = items.find((i) => `${i.id}` === `${r.id ?? r.ID ?? ''}`);
      const matchByName = items.find(
        (i) => i.name?.trim().toLowerCase() === String(baseName || '').trim().toLowerCase()
      );
      return {
        id: createRowId(),
        itemId: r.id ? String(r.id) : r.ID ? String(r.ID) : matchById?.id ? String(matchById.id) : undefined,
        externalKey: r.external_key || r.externalKey || matchById?.external_key || matchByName?.external_key,
        name: String(baseName ?? '').trim(),
        price: r.price !== undefined ? String(r.price) : String(r.Price ?? ''),
        category: String(r.category ?? r.Category ?? '').trim(),
        description: r.description ? String(r.description) : String(r.Description ?? ''),
        tags: r.tags ? String(r.tags) : String(r.Tags ?? ''),
        errors: {},
      } as EditableRow;
    });
}

function validateRow(row: EditableRow, categories: any[]) {
  const errors: EditableRow['errors'] = {};
  const name = row.name?.trim();
  const priceNum = parseFloat(row.price);
  const categoryName = row.category?.trim();
  const normalizedTags = (row.tags || '')
    .split(/[,|]/)
    .map((t) => normalizeTag(t))
    .filter(Boolean);

  if (!name) errors.name = 'Name is required';
  if (!row.price || Number.isNaN(priceNum) || priceNum <= 0) {
    errors.price = 'Price must be a number greater than 0';
  }
  if (!categoryName) errors.category = 'Category is required';
  const invalidTags = normalizedTags.filter((t) => !ALLOWED_TAGS.includes(t));
  if (invalidTags.length) {
    errors.tags = `Unsupported tags: ${invalidTags.join(', ')}`;
  }

  let suggestion: string | null = null;
  const catKey = categoryName?.toLowerCase?.();
  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  if (categoryName && !categories.some((c) => c.name?.toLowerCase?.() === catKey) && categoryNames.length) {
    const match = findBestMatch(categoryName, categoryNames);
    if (match.bestMatch.rating >= 0.5 && match.bestMatch.target !== categoryName) {
      suggestion = match.bestMatch.target;
    }
  }

  return { ...row, errors, suggestion };
}

export default function MenuCsvModal({ open, onClose, restaurantId, categories, items, onImported }: MenuCsvModalProps) {
  const [activeTab, setActiveTab] = useState<CsvMode>('import');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [apiRowErrors, setApiRowErrors] = useState<RowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [warning, setWarning] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setParseError('');
      setApiRowErrors([]);
      setImporting(false);
      setSuccessMessage('');
      setWarning('');
      setBulkPreview(null);
      setConfirmArchive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const validatedRows = useMemo(
    () => rows.map((r) => validateRow(r, categories)),
    [rows, categories]
  );

  const hasErrors = validatedRows.some((r) => Object.keys(r.errors).length > 0);

  const archiveCandidates = useMemo(() => {
    if (activeTab !== 'bulk' || !validatedRows.length) return [] as any[];
    const incomingIds = new Set(
      validatedRows.map((r) => (r.itemId ? String(r.itemId) : r.name.toLowerCase()))
    );
    return items.filter((i) => !incomingIds.has(String(i.id)) && !incomingIds.has(String(i.name || '').toLowerCase()));
  }, [activeTab, validatedRows, items]);

  const readyToSubmit = useMemo(() => {
    if (importing || !validatedRows.length || hasErrors) return false;
    if (activeTab === 'bulk' && bulkPreview) {
      if (bulkPreview.willArchive > 0 && !confirmArchive) return false;
      return true;
    }
    return true;
  }, [importing, validatedRows, hasErrors, activeTab, bulkPreview, confirmArchive]);

  const setRowValue = (id: string, key: keyof EditableRow, value: string) => {
    setBulkPreview(null);
    setConfirmArchive(false);
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const onSuggestionAccept = (id: string, suggestion?: string | null) => {
    if (!suggestion) return;
    setRowValue(id, 'category', suggestion);
  };

  const parseFile = (file: File) => {
    setParseError('');
    setWarning('');
    setSuccessMessage('');
    setApiRowErrors([]);
    setBulkPreview(null);
    setConfirmArchive(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors?.length) {
          setParseError(results.errors[0]?.message || 'Failed to parse CSV');
          return;
        }
        const rawRows = (results.data as any[]) || [];
        if (!rawRows.length) {
          setParseError('No rows found in CSV');
          return;
        }
        const processed = extractCsvRows(rawRows, items).map((row) => validateRow(row, categories));
        setRows(processed);
        if (activeTab === 'bulk') {
          setWarning('Preview changes first. Items missing from your upload will be archived after confirmation.');
        }
      },
      error: (err) => {
        setParseError(err?.message || 'Failed to read CSV');
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const downloadCsv = async (mode: 'sample' | 'export') => {
    const res = await fetch(`/api/menu-csv?mode=${mode}`);
    if (!res.ok) {
      setParseError('Failed to download CSV');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = mode === 'sample' ? 'menu-sample.csv' : 'menu-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!restaurantId) return;
    setImporting(true);
    setParseError('');
    setApiRowErrors([]);
    setSuccessMessage('');

    try {
      const payloadRows = validatedRows.map((r) => ({
        id: r.itemId,
        external_key: r.externalKey,
        name: r.name.trim(),
        price: r.price,
        category: r.category.trim(),
        description: r.description,
        tags: r.tags,
      }));

      const res = await fetch('/api/menu-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          mode: activeTab,
          rows: payloadRows,
          confirm: activeTab === 'bulk' ? Boolean(bulkPreview) : true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setParseError(json.message || json.error || 'Failed to import CSV');
        if (Array.isArray(json.rowErrors)) setApiRowErrors(json.rowErrors);
        return;
      }

      if (activeTab === 'bulk' && json.preview) {
        setBulkPreview(json.preview as BulkPreview);
        if (json.preview.willArchive > 0) {
          setWarning('Items missing from your upload will be archived. Confirm before applying.');
        }
        return;
      }

      const summaryParts: string[] = [];
      if (json.created) summaryParts.push(`${json.created} created`);
      if (json.updated) summaryParts.push(`${json.updated} updated`);
      if (json.archived) summaryParts.push(`${json.archived} archived`);
      const message = summaryParts.length ? summaryParts.join(', ') : 'Import completed';
      setSuccessMessage(message);
      onImported(message);
      onClose();
    } catch (err: any) {
      setParseError(err?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const errorSummary = useMemo(() => {
    const localErrors: RowError[] = [];
    validatedRows.forEach((row, idx) => {
      Object.values(row.errors).forEach((reason) => {
        if (reason) localErrors.push({ rowIndex: idx + 1, reason });
      });
    });
    return [...localErrors, ...apiRowErrors].slice(0, 5);
  }, [validatedRows, apiRowErrors]);

  const renderTable = () => {
    if (!validatedRows.length) return null;
    return (
      <div className="mt-4 overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {activeTab === 'bulk' && (
                <th className="px-3 py-2 text-left font-semibold text-gray-700">ID</th>
              )}
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Price</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {validatedRows.map((row, idx) => (
              <tr key={row.id} className="align-top">
                {activeTab === 'bulk' && (
                  <td className="px-3 py-2 text-xs text-gray-600 align-middle">{row.itemId || '—'}</td>
                )}
                <td className="px-3 py-2">
                  <input
                    value={row.name}
                    onChange={(e) => setRowValue(row.id, 'name', e.target.value)}
                    className={`w-full rounded border px-2 py-1 text-sm ${
                      row.errors.name ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {row.errors.name && (
                    <p className="mt-1 text-xs text-red-600">{row.errors.name}</p>
                  )}
                  {apiRowErrors.find((r) => r.rowIndex === idx + 1) && (
                    <p className="mt-1 text-xs text-red-600">
                      {apiRowErrors.find((r) => r.rowIndex === idx + 1)?.reason}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.price}
                    onChange={(e) => setRowValue(row.id, 'price', e.target.value)}
                    className={`w-full rounded border px-2 py-1 text-sm ${
                      row.errors.price ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {row.errors.price && (
                    <p className="mt-1 text-xs text-red-600">{row.errors.price}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.category}
                    onChange={(e) => setRowValue(row.id, 'category', e.target.value)}
                    className={`w-full rounded border px-2 py-1 text-sm ${
                      row.errors.category ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {row.errors.category && (
                    <p className="mt-1 text-xs text-red-600">{row.errors.category}</p>
                  )}
                  {row.suggestion && !row.errors.category && (
                    <div className="mt-1 flex items-center justify-between rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      <span>Suggested: {row.suggestion}</span>
                      <button
                        type="button"
                        className="text-amber-700 underline"
                        onClick={() => onSuggestionAccept(row.id, row.suggestion)}
                      >
                        Use
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <textarea
                    value={row.description}
                    onChange={(e) => setRowValue(row.id, 'description', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    rows={2}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.tags}
                    onChange={(e) => setRowValue(row.id, 'tags', e.target.value)}
                    className={`w-full rounded border px-2 py-1 text-sm ${
                      row.errors.tags ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder="vegan, vegetarian"
                  />
                  {row.errors.tags && (
                    <p className="mt-1 text-xs text-red-600">{row.errors.tags}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const modeTitle = activeTab === 'import' ? 'Import' : 'Bulk Update';
  const primaryLabel = activeTab === 'import' ? 'Import items' : bulkPreview ? 'Apply changes' : 'Preview changes';

  return (
    <div
      className={`fixed inset-0 z-[1100] bg-black/40 ${open ? '' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!open}
    >
      {open && (
        <div className="flex h-full items-center justify-center p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold">CSV Import & Bulk Update</h2>
                <p className="text-sm text-gray-600">
                  Upload a CSV to import new items or update your existing menu. Inline edits are applied before save.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="border-b px-6 pt-2">
              <div className="flex space-x-4">
                <button
                  className={`px-3 py-2 text-sm font-medium ${
                    activeTab === 'import'
                      ? 'border-b-2 border-teal-600 text-teal-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setActiveTab('import');
                    setBulkPreview(null);
                    setConfirmArchive(false);
                  }}
                >
                  Import
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium ${
                    activeTab === 'bulk'
                      ? 'border-b-2 border-teal-600 text-teal-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setActiveTab('bulk');
                    setBulkPreview(null);
                    setConfirmArchive(false);
                  }}
                >
                  Bulk Update
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Upload CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadCsv('sample')}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Download sample CSV
                </button>
                {activeTab === 'bulk' && (
                  <button
                    type="button"
                    onClick={() => downloadCsv('export')}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Download menu CSV
                  </button>
                )}
              </div>

              <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold">{modeTitle} instructions</p>
                {activeTab === 'import' ? (
                  <p>Upload a CSV to import new items. All rows must be valid; imports are all-or-nothing.</p>
                ) : (
                  <p>Download your current menu, edit in bulk, and re-upload. Changes are previewed before applying.</p>
                )}
                <p className="mt-1">
                  Expected columns: Name (required), Price (required), Category (required), Description (optional), Tags (optional).
                  Allowed tags: {ALLOWED_TAGS.map((t) => tagLabels[t]).join(', ')}.
                </p>
              </div>

              {parseError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</div>}
              {warning && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>}
              {successMessage && (
                <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div>
              )}

              {errorSummary.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold">Row issues</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {errorSummary.map((e, idx) => (
                      <li key={`${e.rowIndex}-${idx}`}>
                        Row {e.rowIndex}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bulkPreview && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-semibold">Bulk update preview</p>
                  <p className="mt-1">Creates: {bulkPreview.willCreate || 0}</p>
                  <p>Updates: {bulkPreview.willUpdate || 0}</p>
                  <p>Archives: {bulkPreview.willArchive || 0}</p>
                  {bulkPreview.willArchive > 0 && (
                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        id="confirm-archive"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={confirmArchive}
                        onChange={(e) => setConfirmArchive(e.target.checked)}
                      />
                      <label htmlFor="confirm-archive" className="text-xs text-blue-900">
                        I understand missing items will be archived.
                      </label>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bulk' && archiveCandidates.length > 0 && !bulkPreview && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {archiveCandidates.length} existing item(s) may be archived if omitted. Preview changes before applying.
                </div>
              )}

              {renderTable()}
            </div>

            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-gray-600">
                {validatedRows.length > 0 &&
                  `${validatedRows.length} row(s) ready. Validation must pass before ${modeTitle.toLowerCase()}.`}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!readyToSubmit}
                  onClick={submit}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                    readyToSubmit ? 'bg-teal-600 hover:bg-teal-700' : 'cursor-not-allowed bg-gray-400'
                  }`}
                >
                  {importing ? 'Processing...' : primaryLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
