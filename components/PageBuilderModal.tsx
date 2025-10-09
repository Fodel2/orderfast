import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Block } from './PageRenderer';
import WebpageBuilder from './webpage/WebpageBuilder';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  open: boolean;
  onClose: () => void;
  pageId: string;
  restaurantId: string;
};

const DEFAULT_BLOCKS: Block[] = [
  { id: 'h1', type: 'heading', text: 'New Page', level: 1, align: 'left' },
  { id: 'txt', type: 'text', text: 'Start writing…', align: 'left' }
];

const NEW_BLOCKS: Record<string, () => Block> = {
  heading: () => ({ id: crypto.randomUUID(), type: 'heading', text: 'Heading', level: 2, align: 'left' }),
  text: () => ({ id: crypto.randomUUID(), type: 'text', text: 'Paragraph text', align: 'left' }),
  image: () => ({ id: crypto.randomUUID(), type: 'image', src: 'https://placehold.co/1200x600', alt: 'Image', width: 1200, radius: 'lg' }),
  button: () => ({ id: crypto.randomUUID(), type: 'button', label: 'Button', href: '#', style: 'primary', align: 'left' }),
  divider: () => ({ id: crypto.randomUUID(), type: 'divider' }),
  spacer: () => ({ id: crypto.randomUUID(), type: 'spacer', height: 24 }),
  'two-col': () => ({ id: crypto.randomUUID(), type: 'two-col', left: [{ id: crypto.randomUUID(), type: 'text', text: 'Left' }], right: [{ id: crypto.randomUUID(), type: 'text', text: 'Right' }], ratio: '1-1', gap: 16 }),
};

function cloneBlockWithIds(block: Block): Block {
  const baseId = crypto.randomUUID();
  switch (block.type) {
    case 'two-col':
      return {
        ...block,
        id: baseId,
        left: block.left.map(cloneBlockWithIds),
        right: block.right.map(cloneBlockWithIds),
      };
    default:
      return { ...block, id: baseId };
  }
}

export default function PageBuilderModal({ open, onClose, pageId, restaurantId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const [selection, setSelection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const history = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);

  // Load page JSON
  useEffect(() => {
    if (!open || !pageId) return;
    (async () => {
      const { data, error } = await supabase
        .from('custom_pages')
        .select('content_json')
        .eq('id', pageId)
        .eq('restaurant_id', restaurantId)
        .single();
      if (!error) {
        const parsed: Block[] = Array.isArray(data?.content_json) ? (data!.content_json as any) : DEFAULT_BLOCKS;
        setBlocks(parsed.length ? parsed : DEFAULT_BLOCKS);
      }
    })();
  }, [open, pageId, restaurantId]);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // undo stack helper
  const pushHistory = useCallback((next: Block[]) => {
    history.current.push(next);
    if (history.current.length > 50) history.current.shift();
    future.current = [];
  }, []);

  function addBlock(kind: keyof typeof NEW_BLOCKS) {
    const next = [...blocks, NEW_BLOCKS[kind]()];
    pushHistory(blocks);
    setBlocks(next);
  }

  function removeBlock(id: string) {
    const next = blocks.filter(b => b.id !== id);
    pushHistory(blocks);
    setBlocks(next);
    if (selection === id) setSelection(null);
  }

  function duplicateBlock(id: string) {
    const index = blocks.findIndex(b => b.id === id);
    if (index < 0) return;
    const clone = cloneBlockWithIds(blocks[index]);
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    pushHistory(blocks);
    setBlocks(next);
    setSelection(clone.id);
  }

  function moveBlock(id: string, direction: -1|1) {
    const idx = blocks.findIndex(b => b.id === id);
    const ni = idx + direction;
    if (idx < 0 || ni < 0 || ni >= blocks.length) return;
    const next = [...blocks];
    const [m] = next.splice(idx, 1);
    next.splice(ni, 0, m);
    pushHistory(blocks);
    setBlocks(next);
  }

  function reorderBlocks(next: Block[]) {
    pushHistory(blocks);
    setBlocks(next);
  }

  function updateBlock(id: string, patch: Partial<any>) {
    const next = blocks.map(b => b.id === id ? { ...b, ...patch } as Block : b);
    pushHistory(blocks);
    setBlocks(next);
  }

  const handleAddBlock = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setPaletteOpen(true);
    } else {
      addBlock('text');
    }
  };

  useEffect(() => {
    if (selection) setInspectorOpen(true);
  }, [selection]);

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push(blocks);
    setBlocks(prev);
  }
  function redo() {
    const nxt = future.current.pop();
    if (!nxt) return;
    history.current.push(blocks);
    setBlocks(nxt);
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_pages')
        .update({ content_json: blocks })
        .eq('id', pageId)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      alert('Saved');
    } catch (e:any) {
      console.error(e);
      alert(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[61] m-4 flex w-[calc(100%-2rem)] flex-1 rounded-2xl bg-white shadow-2xl overflow-hidden flex-col md:flex-row">
        {/* Mobile toolbar */}
        <div className="md:hidden flex items-center justify-between border-b p-2">
          <button onClick={() => setPaletteOpen(true)} className="px-2 py-1 rounded border">Blocks</button>
          <div className="space-x-2">
            <button onClick={undo} className="px-2 py-1 rounded border">Undo</button>
            <button onClick={redo} className="px-2 py-1 rounded border">Redo</button>
          </div>
          <div className="space-x-2">
            <button onClick={save} disabled={saving} className="px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">{saving?'Saving…':'Save'}</button>
            <button onClick={onClose} className="px-2 py-1 rounded border">Close</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left palette desktop */}
          <aside className="w-60 border-r p-3 space-y-3 hidden md:block">
            <div className="text-sm font-semibold mb-2">Blocks</div>
            {(['heading','text','image','button','divider','spacer','two-col'] as const).map(k => (
              <button key={k} onClick={() => addBlock(k)} className="w-full rounded border px-3 py-2 text-left">
                + {k}
              </button>
            ))}
            <div className="mt-6 space-x-2">
              <button onClick={undo} className="px-2 py-1 rounded border">Undo</button>
              <button onClick={redo} className="px-2 py-1 rounded border">Redo</button>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 overflow-hidden">
            <WebpageBuilder
              blocks={blocks}
              selectedBlockId={selection}
              onSelectBlock={(id) => setSelection(id)}
              onDeleteBlock={removeBlock}
              onDuplicateBlock={duplicateBlock}
              onMoveBlock={moveBlock}
              onReorderBlocks={reorderBlocks}
              onAddBlock={handleAddBlock}
            />
          </main>

          {/* Inspector desktop */}
          <aside className="w-72 border-l p-4 hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Inspector</div>
              <div className="space-x-2">
                <button onClick={save} disabled={saving} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">{saving?'Saving…':'Save'}</button>
                <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
              </div>
            </div>
            {!selection ? (
              <div className="text-sm text-neutral-500">Select a block to edit its properties.</div>
            ) : (
              <Inspector
                key={selection}
                block={blocks.find(b => b.id===selection)!}
                onChange={(patch) => updateBlock(selection, patch)}
              />
            )}
          </aside>
        </div>
      </div>

      {/* Mobile palette overlay */}
      {paletteOpen && (
        <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r p-3 space-y-3 z-[62] md:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Blocks</div>
            <button onClick={() => setPaletteOpen(false)} className="px-2 py-1 rounded border">Close</button>
          </div>
          {(['heading','text','image','button','divider','spacer','two-col'] as const).map(k => (
            <button key={k} onClick={() => { addBlock(k); setPaletteOpen(false); }} className="w-full rounded border px-3 py-2 text-left">
              + {k}
            </button>
          ))}
          <div className="mt-6 space-x-2">
            <button onClick={undo} className="px-2 py-1 rounded border">Undo</button>
            <button onClick={redo} className="px-2 py-1 rounded border">Redo</button>
          </div>
        </aside>
      )}

      {/* Mobile inspector drawer */}
      {selection && inspectorOpen && (
        <div className="fixed bottom-0 left-0 right-0 max-h-[50%] bg-white border-t p-4 z-[62] overflow-y-auto md:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Inspector</div>
            <button onClick={() => setInspectorOpen(false)} className="px-2 py-1 rounded border">Close</button>
          </div>
          <Inspector
            key={selection}
            block={blocks.find(b => b.id===selection)!}
            onChange={(patch) => updateBlock(selection, patch)}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium mb-1 text-neutral-600">{label}</div>
      {children}
    </label>
  );
}

function Inspector({ block, onChange }: { block: Block; onChange: (patch: Partial<any>) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div>
          <Field label="Text"><input className="w-full rounded border px-2 py-1" value={block.text} onChange={e=>onChange({ text: e.target.value })} /></Field>
          <Field label="Level">
            <select className="w-full rounded border px-2 py-1" value={block.level ?? 2} onChange={e=>onChange({ level: Number(e.target.value) })}>
              <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
            </select>
          </Field>
          <Align value={block.align ?? 'left'} onChange={(align)=>onChange({ align })} />
        </div>
      );
    case 'text':
      return (
        <div>
          <Field label="Text"><textarea rows={6} className="w-full rounded border px-2 py-1" value={block.text} onChange={e=>onChange({ text: e.target.value })} /></Field>
          <Align value={block.align ?? 'left'} onChange={(align)=>onChange({ align })} />
        </div>
      );
    case 'image':
      return (
        <div>
          <Field label="Image URL"><input className="w-full rounded border px-2 py-1" value={block.src} onChange={e=>onChange({ src: e.target.value })} /></Field>
          <Field label="Alt text"><input className="w-full rounded border px-2 py-1" value={block.alt ?? ''} onChange={e=>onChange({ alt: e.target.value })} /></Field>
          <Field label="Max width (px)"><input type="number" className="w-full rounded border px-2 py-1" value={block.width ?? 1200} onChange={e=>onChange({ width: Number(e.target.value) })} /></Field>
          <Field label="Corner radius">
            <select className="w-full rounded border px-2 py-1" value={block.radius ?? 'lg'} onChange={e=>onChange({ radius: e.target.value })}>
              <option value="none">None</option><option value="lg">Large</option><option value="2xl">2XL</option>
            </select>
          </Field>
        </div>
      );
    case 'button':
      return (
        <div>
          <Field label="Label"><input className="w-full rounded border px-2 py-1" value={block.label} onChange={e=>onChange({ label: e.target.value })} /></Field>
          <Field label="Link (href)"><input className="w-full rounded border px-2 py-1" value={block.href ?? ''} onChange={e=>onChange({ href: e.target.value })} /></Field>
          <Field label="Style">
            <select className="w-full rounded border px-2 py-1" value={block.style ?? 'primary'} onChange={e=>onChange({ style: e.target.value })}>
              <option value="primary">Primary</option><option value="outline">Outline</option>
            </select>
          </Field>
          <Align value={block.align ?? 'left'} onChange={(align)=>onChange({ align })} />
        </div>
      );
    case 'spacer':
      return (
        <div>
          <Field label="Height (px)"><input type="number" className="w-full rounded border px-2 py-1" value={block.height ?? 24} onChange={e=>onChange({ height: Number(e.target.value) })} /></Field>
        </div>
      );
    case 'divider':
      return <div className="text-sm text-neutral-500">No options.</div>;
    case 'two-col':
      return (
        <div>
          <Field label="Ratio">
            <select className="w-full rounded border px-2 py-1" value={block.ratio ?? '1-1'} onChange={e=>onChange({ ratio: e.target.value })}>
              <option value="1-1">50 / 50</option><option value="1-2">33 / 67</option><option value="2-1">67 / 33</option>
            </select>
          </Field>
          <Field label="Gap (px)"><input type="number" className="w-full rounded border px-2 py-1" value={block.gap ?? 16} onChange={e=>onChange({ gap: Number(e.target.value) })} /></Field>
          <div className="text-xs text-neutral-500 mt-2">Edit the nested blocks by clicking them directly on the canvas.</div>
        </div>
      );
    default:
      return null;
  }
}

function Align({ value, onChange }: { value: 'left'|'center'|'right'; onChange: (v:any)=>void }) {
  return (
    <Field label="Alignment">
      <div className="flex gap-2">
        {(['left','center','right'] as const).map(a => (
          <button key={a} onClick={()=>onChange(a)} className={`px-2 py-1 rounded border ${value===a?'bg-emerald-50 border-emerald-600':''}`}>{a}</button>
        ))}
      </div>
    </Field>
  );
}

