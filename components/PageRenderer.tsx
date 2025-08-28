import React from 'react';

export type Block =
  | { id: string; type: 'heading'; text: string; level?: 1|2|3; align?: 'left'|'center'|'right'; }
  | { id: string; type: 'text'; text: string; align?: 'left'|'center'|'right'; }
  | { id: string; type: 'image'; src: string; alt?: string; width?: number; radius?: 'none'|'lg'|'2xl'; }
  | { id: string; type: 'button'; label: string; href?: string; target?: '_self'|'_blank'; style?: 'primary'|'outline'; align?: 'left'|'center'|'right'; }
  | { id: string; type: 'divider'; }
  | { id: string; type: 'spacer'; height?: number; }
  | { id: string; type: 'two-col'; left: Block[]; right: Block[]; ratio?: '1-1'|'1-2'|'2-1'; gap?: number; };

export default function PageRenderer({ blocks }: { blocks: Block[] }) {
  function renderBlock(b: Block, i?: number) {
    switch (b.type) {
      case 'heading': {
        const Tag = b.level === 3 ? 'h3' : b.level === 2 ? 'h2' : 'h1';
        const align = b.align ?? 'left';
        return <Tag key={b.id} className={`mb-3 font-semibold text-${align} ${Tag==='h1'?'text-3xl':Tag==='h2'?'text-2xl':'text-xl'}`}>{b.text}</Tag>;
      }
      case 'text':
        return <p key={b.id} className={`mb-4 leading-7 text-${b.align ?? 'left'}`}>{b.text}</p>;
      case 'image': {
        const radius = b.radius === '2xl' ? 'rounded-2xl' : b.radius === 'lg' ? 'rounded-lg' : '';
        const style = `mb-4 ${radius} w-full`;
        return <img key={b.id} src={b.src} alt={b.alt ?? ''} className={style} style={b.width ? { maxWidth: b.width } : undefined} />;
      }
      case 'button': {
        const align = b.align ?? 'left';
        const base = b.style === 'outline'
          ? 'border border-emerald-600 text-emerald-700'
          : 'bg-emerald-600 text-white';
        return (
          <div key={b.id} className={`mb-4 flex ${align==='center'?'justify-center':align==='right'?'justify-end':'justify-start'}`}>
              <a href={b.href ?? '#'} target={b.target ?? '_self'} className={`px-4 py-2 rounded-xl ${base}`}>{b.label}</a>
          </div>
        );
      }
      case 'divider':
        return <hr key={b.id} className="my-6 border-neutral-200" />;
      case 'spacer':
        return <div key={b.id} style={{ height: (b.height ?? 24) }} />;
      case 'two-col': {
        const ratio = b.ratio ?? '1-1';
        const [l,r] = ratio === '1-2' ? ['1fr','2fr'] : ratio === '2-1' ? ['2fr','1fr'] : ['1fr','1fr'];
        return (
          <div key={b.id} className="grid gap-4 my-4" style={{ gridTemplateColumns: `${l} ${r}` }}>
            <div>{b.left?.map(renderBlock)}</div>
            <div>{b.right?.map(renderBlock)}</div>
          </div>
        );
      }
      default:
        return null;
    }
  }

  return <div>{blocks.map(renderBlock)}</div>;
}
