export function scrollElementToTop(el: HTMLElement, headerOffset = 0, behavior: ScrollBehavior = 'smooth') {
  if (typeof window === 'undefined') return;
  const safeAreaInsetTop =
    Number.parseFloat(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('padding-top')
        .replace('px', '')
    ) || 0;
  const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
  const targetTop = Math.max(0, absoluteTop - headerOffset - safeAreaInsetTop);
  window.scrollTo({ top: targetTop, behavior });
}
