// Lazy-loaded Tesseract.js wrapper for OCR.
// First call downloads the worker + language data (~5MB for por) — subsequent
// calls reuse the same worker process.

let workerPromise: Promise<any> | null = null;

export type ProgressCb = (info: { status: string; progress: number }) => void;

async function getWorker(lang: string, onProgress?: ProgressCb): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m: any) => {
          if (onProgress) onProgress({ status: m.status || '', progress: m.progress || 0 });
        }
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeImage(
  source: string | Blob | File,
  opts: { lang?: string; onProgress?: ProgressCb } = {}
): Promise<{ text: string; confidence: number }> {
  const lang = opts.lang || 'por';
  const worker = await getWorker(lang, opts.onProgress);
  const result = await worker.recognize(source);
  return {
    text: (result?.data?.text || '').trim(),
    confidence: result?.data?.confidence || 0
  };
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {}
    workerPromise = null;
  }
}
