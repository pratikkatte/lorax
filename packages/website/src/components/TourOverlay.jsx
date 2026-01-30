import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const CENTER_POS = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)'
};

const ARROW_SIZE = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function TourOverlay({
  open,
  steps = [],
  onClose,
  onFinish,
  startAt = 0,
  onStepChange
}) {
  const [index, setIndex] = useState(startAt);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(CENTER_POS);
  const [arrowDir, setArrowDir] = useState('up');
  const [arrowX, setArrowX] = useState(null);
  const [arrowY, setArrowY] = useState(null);
  const tooltipRef = useRef(null);

  const step = steps[index] || null;

  useEffect(() => {
    if (open) {
      setIndex(startAt);
    }
  }, [open, startAt]);

  useEffect(() => {
    if (!open || !step) return;
    onStepChange?.(index, step);
    if (typeof step.onEnter === 'function') {
      step.onEnter();
    }
  }, [open, step, index, onStepChange]);

  const updateTarget = useMemo(() => {
    return () => {
      if (!open || !step) {
        setTargetRect(null);
        return;
      }
      if (typeof step.getTargetRect === 'function') {
        const rect = step.getTargetRect();
        setTargetRect(rect || null);
        return;
      }
      if (step.targetRect) {
        setTargetRect(step.targetRect);
        return;
      }
      if (!step.target) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    };
  }, [open, step, step?.target, step?.targetRect, step?.getTargetRect]);

  useEffect(() => {
    updateTarget();
  }, [updateTarget, index, open, step?.targetKey]);

  useEffect(() => {
    if (!open) return;
    const handle = () => updateTarget();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open, updateTarget]);

  useLayoutEffect(() => {
    if (!open) return;
    if (!targetRect || !tooltipRef.current) {
      setTooltipPos(CENTER_POS);
      setArrowX(null);
      return;
    }
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 12;
    let left = clamp(
      targetRect.left + targetRect.width / 2 - tipRect.width / 2,
      padding,
      window.innerWidth - tipRect.width - padding
    );

    let top = targetRect.bottom + 12;
    if (top + tipRect.height > window.innerHeight - padding) {
      top = targetRect.top - tipRect.height - 12;
    }
    const offsetX = Number.isFinite(step?.offset?.x) ? step.offset.x : 0;
    const offsetY = Number.isFinite(step?.offset?.y) ? step.offset.y : 0;
    left = clamp(left + offsetX, padding, window.innerWidth - tipRect.width - padding);
    top = clamp(top + offsetY, padding, window.innerHeight - tipRect.height - padding);
    setTooltipPos({ top, left });

    const tooltipTop = top;
    const tooltipBottom = top + tipRect.height;
    const tooltipLeft = left;
    const tooltipRight = left + tipRect.width;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    const isBelow = tooltipTop > targetRect.bottom;
    const dir = step?.arrowDir || (isBelow ? 'up' : 'down');
    setArrowDir(dir);

    if (dir === 'left' || dir === 'right') {
      const arrowCenterY = clamp(targetCenterY, tooltipTop + 24, tooltipBottom - 24);
      setArrowY(arrowCenterY - tooltipTop);
      setArrowX(null);
    } else {
      const arrowCenterX = clamp(targetCenterX, tooltipLeft + 24, tooltipRight - 24);
      setArrowX(arrowCenterX - tooltipLeft);
      setArrowY(null);
    }

  }, [open, targetRect, index]);

  if (!open || !step) return null;

  const isLast = index === steps.length - 1;
  const disableNext = step?.disableNext === true;

  return (
    <>
      <div className="fixed inset-0 z-[100000] pointer-events-none">
        <style>{`
          .tour-gesture-media {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        `}</style>
        {/* Dim background */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />

        {/* Highlight box */}
        {targetRect && (
          <div
            className="absolute rounded-xl border-2 border-emerald-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed max-w-xs w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 pointer-events-auto z-[100001]"
        style={tooltipPos}
      >
        {/* Speech-bubble caret */}
        {((arrowDir === 'left' || arrowDir === 'right') ? arrowY !== null : arrowX !== null) && (
          <div
            className="absolute"
            style={{
              left: arrowDir === 'right' ? 'auto' : arrowDir === 'left' ? -ARROW_SIZE * 2 - 2 : arrowX - ARROW_SIZE,
              right: arrowDir === 'right' ? -ARROW_SIZE * 2 - 2 : 'auto',
              top: arrowDir === 'left' || arrowDir === 'right' ? arrowY - ARROW_SIZE : arrowDir === 'up' ? -ARROW_SIZE * 2 - 2 : 'auto',
              bottom: arrowDir === 'down' ? -ARROW_SIZE * 2 - 2 : 'auto',
              width: 0,
              height: 0,
              borderLeft: arrowDir === 'right' ? `${ARROW_SIZE + 2}px solid #e2e8f0` : (arrowDir === 'left' ? 'none' : `${ARROW_SIZE}px solid transparent`),
              borderRight: arrowDir === 'left' ? `${ARROW_SIZE + 2}px solid #e2e8f0` : (arrowDir === 'right' ? 'none' : `${ARROW_SIZE}px solid transparent`),
              borderTop: arrowDir === 'down' ? `${ARROW_SIZE + 2}px solid #e2e8f0` : (arrowDir === 'up' ? 'none' : `${ARROW_SIZE}px solid transparent`),
              borderBottom: arrowDir === 'up' ? `${ARROW_SIZE + 2}px solid #e2e8f0` : (arrowDir === 'down' ? 'none' : `${ARROW_SIZE}px solid transparent`)
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: arrowDir === 'right' ? -ARROW_SIZE - 2 : arrowDir === 'left' ? 2 : -ARROW_SIZE + 2,
                right: arrowDir === 'right' ? 2 : 'auto',
                top: arrowDir === 'left' || arrowDir === 'right' ? -ARROW_SIZE + 2 : arrowDir === 'up' ? 2 : 'auto',
                bottom: arrowDir === 'down' ? 2 : 'auto',
                width: 0,
                height: 0,
                borderLeft: arrowDir === 'right' ? `${ARROW_SIZE}px solid #ffffff` : (arrowDir === 'left' ? 'none' : `${ARROW_SIZE - 1}px solid transparent`),
                borderRight: arrowDir === 'left' ? `${ARROW_SIZE}px solid #ffffff` : (arrowDir === 'right' ? 'none' : `${ARROW_SIZE - 1}px solid transparent`),
                borderTop: arrowDir === 'down' ? `${ARROW_SIZE}px solid #ffffff` : (arrowDir === 'up' ? 'none' : `${ARROW_SIZE - 1}px solid transparent`),
                borderBottom: arrowDir === 'up' ? `${ARROW_SIZE}px solid #ffffff` : (arrowDir === 'down' ? 'none' : `${ARROW_SIZE - 1}px solid transparent`),
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))'
              }}
            />
          </div>
        )}
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2">
          Step {index + 1} of {steps.length}
        </div>
        {step.title && (
          <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
        )}
        {step.content && (
          <p className="text-sm text-slate-600 leading-relaxed">{step.content}</p>
        )}
        {step.animation && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {step.animation.label}
            </div>
            <div className="relative h-24 flex items-center justify-center">
              <div className="relative w-full h-20 rounded-lg border border-slate-300 bg-white overflow-hidden">
                {step.animation.showCtrl && (
                  <div className="absolute left-2 top-2 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded">
                    Ctrl
                  </div>
                )}
                {step.animation.mediaType === 'video' ? (
                  <video
                    className="tour-gesture-media"
                    style={step.animation.rotate ? { transform: `rotate(${step.animation.rotate}deg)` } : undefined}
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-label={step.animation.mediaAlt || step.animation.label}
                  >
                    <source src={step.animation.mediaUrl} type="video/ogg" />
                    {step.animation.mediaAlt || step.animation.label}
                  </video>
                ) : (
                  <img
                    className="tour-gesture-media"
                    src={step.animation.mediaUrl}
                    alt={step.animation.mediaAlt || step.animation.label}
                    style={step.animation.rotate ? { transform: `rotate(${step.animation.rotate}deg)` } : undefined}
                    loading="lazy"
                  />
                )}
              </div>
            </div>
            {step.animation.attribution && (
              <div className="mt-2 text-[10px] text-slate-400">
                Media: {step.animation.attribution}
              </div>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button
            className="text-sm text-slate-500 hover:text-slate-900"
            onClick={() => {
              onClose?.();
              onFinish?.();
            }}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
              disabled={index === 0}
            >
              Back
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                if (disableNext) return;
                if (isLast) {
                  onClose?.();
                  onFinish?.();
                } else {
                  setIndex((prev) => Math.min(steps.length - 1, prev + 1));
                }
              }}
              disabled={disableNext}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
