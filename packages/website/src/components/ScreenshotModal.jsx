import React, { useCallback, useEffect, useMemo, useState } from 'react';

function ScreenshotModal({ deckRef, polygonFillColor, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);
  const [previewMode, setPreviewMode] = useState('svg');
  const [pngUrl, setPngUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const capture = async () => {
      setLoading(true);
      setError(null);
      const deckApi = deckRef?.current;
      if (!deckApi?.getSVGString) {
        setError('Screenshot capture is unavailable.');
        setLoading(false);
        return;
      }

      const svg = deckApi.getSVGString(polygonFillColor);
      if (!svg) {
        setError('Unable to capture the current view.');
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setSvgString(svg);

      const png = await deckApi.getPNGBlob?.(polygonFillColor);
      if (cancelled) return;
      setPngBlob(png || null);
      setLoading(false);
    };

    capture();
    return () => {
      cancelled = true;
    };
  }, [deckRef, polygonFillColor]);

  useEffect(() => {
    if (!pngBlob) {
      setPngUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pngBlob);
    setPngUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pngBlob]);

  const svgUrl = useMemo(() => {
    if (!svgString) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }, [svgString]);

  const downloadBlob = useCallback((blob, filename) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadSvg = useCallback(() => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'lorax-capture.svg');
  }, [svgString, downloadBlob]);

  const handleDownloadPng = useCallback(() => {
    if (!pngBlob) return;
    downloadBlob(pngBlob, 'lorax-capture.png');
  }, [pngBlob, downloadBlob]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose?.();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close screenshot modal"
      />
      <div
        className="relative z-[1001] w-[90%] max-w-3xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Screenshot preview"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="text-lg font-semibold">Screenshot</div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode('svg')}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  previewMode === 'svg'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                SVG Preview
              </button>
              <button
                onClick={() => setPreviewMode('png')}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  previewMode === 'png'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                disabled={!pngUrl}
              >
                PNG Preview
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadSvg}
                className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
                disabled={!svgString}
              >
                Download SVG
              </button>
              <button
                onClick={handleDownloadPng}
                className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
                disabled={!pngBlob}
              >
                Download PNG
              </button>
            </div>
          </div>

          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            {loading && <div className="text-sm text-slate-400">Preparing screenshot...</div>}
            {!loading && error && (
              <div className="text-sm text-rose-300">{error}</div>
            )}
            {!loading && !error && previewMode === 'svg' && svgUrl && (
              <img
                src={svgUrl}
                alt="SVG screenshot preview"
                className="max-h-[60vh] w-full object-contain"
              />
            )}
            {!loading && !error && previewMode === 'png' && pngUrl && (
              <img
                src={pngUrl}
                alt="PNG screenshot preview"
                className="max-h-[60vh] w-full object-contain"
              />
            )}
            {!loading && !error && previewMode === 'png' && !pngUrl && (
              <div className="text-sm text-slate-400">PNG preview not available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenshotModal;
