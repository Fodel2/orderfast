import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { findBestMatch } from 'string-similarity';

const TAG_MAP: Record<string, 'vegan' | 'vegetarian' | '18_plus'> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  '18_plus': '18_plus',
  '18+': '18_plus',
  '18-plus': '18_plus',
};

const ALLOWED_TAGS = ['vegan', 'vegetarian', '18_plus'];

const normalizeTag = (input: string) => {
  const lowered = input.trim().toLowerCase();
  const normalized = lowered.replace(/\s+/g, '_').replace(/-/g, '_');
  return TAG_MAP[normalized] || TAG_MAP[lowered] || normalized;
};

const tagLabels: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  18_plus: '18+',
};

const buildTagText = (item: any) => {
  const tags: string[] = [];
  if (item?.is_vegan) tags.push('vegan');
  if (item?.is_vegetarian) tags.push('vegetarian');
  if (item?.is_18_plus) tags.push('18_plus');
  return tags.join(', ');
};

const sampleRows = [
  {
    name: 'Signature Burger',
    price: '12.50',
    category: 'Burgers',
    description: 'Our classic burger with house sauce',
    tags: 'vegetarian',
  },
  {
    name: 'Spicy Vegan Bowl',
    price: '14.00',
    category: 'Bowls',
    description: 'Loaded with veggies and protein',
    tags: 'vegan',
  },
];

export function triggerSampleCsvDownload() {
  const csv = Papa.unparse(sampleRows, { columns: getCsvHeaders(sampleRows) });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'menu-sample.csv';
  link.click();
  URL.revokeObjectURL(url);
}

type CsvMode = 'import' | 'bulk';

type EditableRow = {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
  tags: string;
  errors: Partial<Record<'name' | 'price' | 'category' | 'tags', string>>;
  suggestion?: string | null;
  matchedItemId?: string | number | null;
};

interface MenuCsvModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: number | null;
  categories: any[];
  items: any[];
  onImported: () => void;
}

function createRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function getCsvHeaders(rows: any[]) {
  const hasDescription = rows.some((r) => r.description);
  const headers = ['name', 'price', 'category'];
  if (hasDescription) headers.push('description');
  headers.push('tags');
  return headers;
}

export default function MenuCsvModal({ open, onClose, restaurantId, categories, items, onImported }: MenuCsvModalProps) {
  const [activeTab, setActiveTab] = useState<CsvMode>('import');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [warning, setWarning] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setParseError('');
      setImporting(false);
      setSuccessMessage('');
      setWarning('');
      setConfirmArchive(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, any>();
    categories
      .filter((c) => !c.archived_at)
      .forEach((cat) => map.set(cat.name?.toLowerCase?.() || '', cat));
    return map;
  }, [categories]);

  const validateRow = (row: EditableRow): EditableRow => {
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
    if (categoryName && !categoryLookup.has(catKey)) {
      const names = categories.map((c) => c.name).filter(Boolean);
      if (names.length) {
        const match = findBestMatch(categoryName, names);
        if (match.bestMatch.rating >= 0.5 && match.bestMatch.target !== categoryName) {
          suggestion = match.bestMatch.target;
        }
      }
    }

    return { ...row, errors, suggestion };
  };

  const setRowValue = (id: string, key: keyof EditableRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? validateRow({ ...row, [key]: value }) : row))
    );
  };

  const onSuggestionAccept = (id: string, suggestion: string | undefined | null) => {
    if (!suggestion) return;
    setRows((prev) =>
      prev.map((row) => (row.id === id ? validateRow({ ...row, category: suggestion }) : row))
    );
  };

  const parseFile = (file: File) => {
    setParseError('');
    setWarning('');
    setSuccessMessage('');
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
        const processed: EditableRow[] = rawRows.map((r) => {
          const row: EditableRow = {
            id: createRowId(),
            name: String(r.name ?? '').trim(),
            price: r.price !== undefined ? String(r.price) : '',
            category: String(r.category ?? '').trim(),
            description: r.description ? String(r.description) : '',
            tags: r.tags ? String(r.tags) : '',
            errors: {},
            matchedItemId: null,
          };
          const existing = items.find(
            (i) => i.name?.trim().toLowerCase() === row.name.toLowerCase()
          );
          if (existing) {
            row.matchedItemId = existing.id;
          }
          return validateRow(row);
        });
        setRows(processed);
        if (activeTab === 'bulk') {
          setWarning('Remember: items missing from your upload will be archived after confirmation.');
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

  const hasErrors = rows.some((r) => Object.keys(r.errors).length > 0);
  const archiveCandidates = useMemo(() => {
    if (activeTab !== 'bulk' || !rows.length) return [] as any[];
    const incomingNames = new Set(rows.map((r) => r.name.toLowerCase()));
    return items.filter((i) => !incomingNames.has(String(i.name || '').toLowerCase()));
  }, [activeTab, rows, items]);

  const readyToSubmit =
    !importing &&
    rows.length > 0 &&
    !hasErrors &&
    (activeTab !== 'bulk' || archiveCandidates.length === 0 || confirmArchive);

  const downloadSample = () => {
    triggerSampleCsvDownload();
  };

  const downloadMenu = () => {
    const rowsToExport = items.map((item) => {
      const category = categories.find((c) => c.id === item.category_id);
      return {
        name: item.name || '',
        price: typeof item.price === 'number' ? item.price.toFixed(2) : '',
        category: category?.name || '',
        description: item.description || '',
        tags: buildTagText(item),
      };
    });
    const csv = Papa.unparse(rowsToExport, { columns: getCsvHeaders(rowsToExport) });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'menu-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!restaurantId) return;
    setImporting(true);
    setSuccessMessage('');
    setWarning('');
    try {
      const payloadRows = rows.map((r) => ({
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
          confirmArchive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParseError(json.error || json.details || 'Failed to import CSV');
        return;
      }
      setSuccessMessage(json.message || 'Import completed');
      onImported();
    } catch (err: any) {
      setParseError(err?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const renderTable = () => {
    if (!rows.length) return null;
    return (
      <div className="mt-4 overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Price</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Tags</th>
              {activeTab === 'bulk' && (
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
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
                  {!row.errors.tags && row.tags && (
                    <p className="mt-1 text-xs text-gray-500">{row.tags}</p>
                  )}
                </td>
                {activeTab === 'bulk' && (
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {row.matchedItemId ? 'Update existing' : 'Create new'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[1100] bg-black/40 ${open ? '' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!open}
    >
      {open && (
        <div className="flex h-full items-center justify-center p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
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
                  onClick={() => setActiveTab('import')}
                >
                  Import
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium ${
                    activeTab === 'bulk'
                      ? 'border-b-2 border-teal-600 text-teal-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('bulk')}
                >
                  Bulk Update
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-4">
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
                  onClick={downloadSample}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Download sample CSV
                </button>
                {activeTab === 'bulk' && (
                  <button
                    type="button"
                    onClick={downloadMenu}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Download menu CSV
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold">Expected columns</p>
                <p>Name (required), Price (required), Category (required), Description (optional), Tags (optional).</p>
                <p>Allowed tags: {ALLOWED_TAGS.map((t) => tagLabels[t]).join(', ')}.</p>
              </div>

              {parseError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</div>}
              {warning && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>}
              {successMessage && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div>
              )}

              {activeTab === 'bulk' && archiveCandidates.length > 0 && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {archiveCandidates.length} existing item(s) will be archived because they are missing from the upload.
                  <div className="mt-2 flex items-center space-x-2">
                    <input
                      id="confirm-archive"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={confirmArchive}
                      onChange={(e) => setConfirmArchive(e.target.checked)}
                    />
                    <label htmlFor="confirm-archive" className="text-xs text-red-800">
                      I understand these items will be archived.
                    </label>
                  </div>
                </div>
              )}

              {renderTable()}
            </div>

            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-gray-600">
                {rows.length > 0 && `${rows.length} row(s) ready. Validation must pass before import.`}
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
                    readyToSubmit
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : 'cursor-not-allowed bg-gray-400'
                  }`}
                >
                  {activeTab === 'import' ? 'Import menu' : 'Apply bulk update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
