// Shared label layout constants (in mm) so the React preview and print output
// cannot drift apart. Components convert these with mmToPx() for preview.
export const LABEL_LAYOUT = {
  qrGapMm: 1.5,
  fieldGapMm: 0.4,
  twoColBorderMm: 0.3,
  twoColPaddingMm: 1.5,
  writeInLineMm: 20,
  writeInMinLineMm: 6,
  writeInBorderMm: 0.3,
};
