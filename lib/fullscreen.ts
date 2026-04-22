export const isDocumentFullscreenActive = () => {
  if (typeof document === 'undefined') return false;
  const anyDoc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement);
};

export const requestDocumentFullscreen = async () => {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  if (!el) return false;
  const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
  if (!request) return false;
  await Promise.resolve(request());
  return true;
};

export const exitDocumentFullscreen = async () => {
  if (typeof document === 'undefined') return;
  const anyDoc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
  };
  if (!isDocumentFullscreenActive()) return;
  const exit = document.exitFullscreen?.bind(document) || anyDoc.webkitExitFullscreen?.bind(document);
  if (!exit) return;
  await Promise.resolve(exit()).catch(() => undefined);
};
