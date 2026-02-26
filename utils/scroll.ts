interface ScrollToTopOptions {
  headerOffset?: number;
  behavior?: ScrollBehavior;
  container?: HTMLElement | null;
}

export function scrollElementToTop(
  el: HTMLElement,
  { headerOffset = 0, behavior = 'smooth', container = null }: ScrollToTopOptions = {}
) {
  if (typeof window === 'undefined') return;
  const safeAreaInsetTop =
    Number.parseFloat(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('padding-top')
        .replace('px', '')
    ) || 0;

  if (container) {
    const elementTop = el.getBoundingClientRect().top;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop =
      container.scrollTop + elementTop - containerTop - headerOffset - safeAreaInsetTop;
    container.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  const absoluteTop = el.getBoundingClientRect().top + window.scrollY;
  const targetTop = Math.max(0, absoluteTop - headerOffset - safeAreaInsetTop);
  window.scrollTo({ top: targetTop, behavior });
}
