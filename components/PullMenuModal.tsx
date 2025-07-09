import { useEffect, useState } from 'react';
import ChefAnimation from './ChefAnimation';

interface PullMenuModalProps {
  show: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

/**
 * Modal dialog prompting the user for a menu URL.
 * Displays a chef animation and rotating jokes while loading.
 */
export default function PullMenuModal({ show, loading, onClose, onSubmit }: PullMenuModalProps) {
  const [url, setUrl] = useState('');
  const jokes = [
    'Arguing with the kitchen printer…',
    'Beating the eggs and the JavaScript…',
    "Checking if the chef’s hat is tall enough…",
    'Making sure the fries are golden and the code is bug-free…',
    'Whisking away the competition…',
  ];
  const [jokeIdx, setJokeIdx] = useState(0);

  // rotate jokes every few seconds while loading
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setJokeIdx((j) => (j + 1) % jokes.length);
    }, 3000);
    return () => clearInterval(id);
  }, [loading, jokes.length]);

  useEffect(() => {
    if (!show) setUrl('');
  }, [show]);

  if (!show) return null;
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {!loading ? (
          <>
            <h3 className="text-xl font-semibold mb-2">Pull Menu</h3>
            <p className="text-sm text-gray-600 mb-4">
              Paste the link to your menu or online ordering page and we’ll do the heavy lifting! Results depend on the site’s design.
            </p>
            <label htmlFor="menuUrl" className="text-sm font-medium">
              Menu Link
            </label>
            <input
              id="menuUrl"
              type="text"
              placeholder="https://deliveroo.co.uk/menu/harrogate/harrogate-city-centre/harrogate-brunch-club"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mt-1 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded">
                Cancel
              </button>
              <button
                onClick={() => onSubmit(url)}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Import
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <ChefAnimation />
            <p className="mt-4 text-sm text-gray-700 text-center min-h-[24px]">{jokes[jokeIdx]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
