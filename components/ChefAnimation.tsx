import React from 'react';

/**
 * Simple bouncing chef emoji used while importing menus.
 * Using Tailwind utility classes for animation.
 */
export default function ChefAnimation() {
  return (
    <div className="text-6xl animate-bounce" role="img" aria-label="Chef">
      👨‍🍳
    </div>
  );
}
