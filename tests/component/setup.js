// happy-dom has no canvas drawing, so give every canvas a 2D context that accepts
// any drawing call and does nothing. The experiments only draw to it; tests never read pixels.
const gradient = () => ({ addColorStop() {} });
const fake2d = (canvas) => {
  const store = { canvas, lineWidth: 1, font: '10px sans-serif', globalAlpha: 1 };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return gradient;
      if (k === 'createPattern') return () => ({});
      if (k === 'getImageData' || k === 'createImageData') return (x, y, w = 1, hh = 1) => ({ width: w, height: hh, data: new Uint8ClampedArray(Math.max(1, w * hh * 4)) });
      if (k === 'getLineDash') return () => [];
      if (k === 'isPointInPath' || k === 'isPointInStroke') return () => false;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
};
HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== '2d') return null;
  return (this.__ctx ||= fake2d(this));
};
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
