export default function PlateIcon({ size=24, className='' }:{size?:number; className?:string}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="32" cy="32" r="28"/>
      <circle cx="32" cy="32" r="18"/>
      <path d="M46 50c-4 3-9 5-14 5"/>
      <path d="M50 36v4"/>
    </svg>
  );
}
