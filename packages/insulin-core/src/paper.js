import { PAPER_SIZES } from './catalog.js';
/** Page dimensions are independent of DOM and usable in other print/PDF adapters. */
export function getPaperSettings(size = 'A4') {
  if (!Object.hasOwn(PAPER_SIZES, size)) throw new TypeError('Formato de papel inválido.');
  const paper = PAPER_SIZES[size];
  return { ...paper, contentWidthMm: paper.widthMm - 30, contentHeightMm: paper.heightMm - 22 };
}
export function getPrintScale(heightPx, size = 'A4') {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return 1;
  return Math.min(1, ((getPaperSettings(size).contentHeightMm - 1) * 96) / 25.4 / heightPx);
}
export function createPaperCss(size = 'A4') {
  const paper = getPaperSettings(size);
  return `@page{size:${paper.cssName};margin:12mm 15mm 10mm}@media print{.hhr-insulin .sheet{width:${paper.contentWidthMm}mm}}`;
}
