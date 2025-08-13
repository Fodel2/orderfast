import React from 'react';

export type Chip = { id?: string; name: string };
export default function CategoryChips({
  categories,
  onSelect,
  activeId,
}: { categories: Chip[]; onSelect?: (c: Chip)=>void; activeId?: string }) {
  return (
    <div style={{position:'sticky',top:56,zIndex:10,background:'white'}}>
      <div className="no-scrollbar" style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 4px 12px 4px'}}>
        {categories.map(c=>(
          <button
            key={c.id || c.name}
            className={`chip ${activeId && (activeId===String(c.id)) ? 'chip-active' : ''}`}
            onClick={()=>onSelect?.(c)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
