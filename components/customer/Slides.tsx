import React from 'react';

export default function Slides({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-y-auto snap-y snap-mandatory">
      {React.Children.map(children, (child, idx) => (
        <div key={idx} className="h-screen snap-start">
          {child}
        </div>
      ))}
    </div>
  );
}
