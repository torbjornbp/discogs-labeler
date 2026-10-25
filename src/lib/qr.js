import qrcode from "qrcode-generator";

// QR codes are generated locally (no third-party service, works offline).
// 6px per module with a full 4-module quiet zone gives a ~222px image for a
// 29-module URL, i.e. enough resolution for a 20mm label at ~280dpi.
const CELL_SIZE = 6;
const MARGIN = CELL_SIZE * 4;
const MAX_CACHE_ENTRIES = 10000;
const CHUNK_SIZE = 12;

const cache = new Map();

export function qrDataUrl(data) {
  if (!data) return "";

  const cached = cache.get(data);
  if (cached !== undefined) return cached;

  let url = "";
  try {
    const qr = qrcode(0, "M"); // type 0 = auto-detect, medium error correction
    qr.addData(String(data));
    qr.make();
    url = qr.createDataURL(CELL_SIZE, MARGIN);
  } catch (err) {
    console.warn("Failed to generate QR code:", err);
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(data, url);
  return url;
}

// Pre-generates (and caches) QR codes in small chunks so a large print job
// doesn't block the UI. The returned map keeps every result available to the
// print job even when older entries are evicted from the bounded global cache.
export async function prepareQrCodes(urls, onProgress, shouldContinue) {
  const unique = [...new Set(urls.filter(Boolean))];
  const total = unique.length;
  const prepared = new Map();
  onProgress?.(0, total);

  let done = 0;
  for (const url of unique) {
    if (shouldContinue && !shouldContinue()) break;
    prepared.set(url, qrDataUrl(url));
    done++;

    if (done % CHUNK_SIZE === 0 || done === total) {
      onProgress?.(done, total);
      if (done < total) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  return prepared;
}

export function clearQrCache() {
  cache.clear();
}
