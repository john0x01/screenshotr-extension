export interface CaptureMetadata {
  title: string;
  url: string;
  domain: string;
  path: string;
  capturedAt: number;
}

export function extractMetadata(tab: chrome.tabs.Tab): CaptureMetadata {
  const url = tab.url ?? '';
  let domain = '';
  let path = '';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    path = parsed.pathname;
  } catch {
    // Non-standard URLs (chrome://, about:, etc.)
    domain = url.split('://')[1]?.split('/')[0] ?? '';
    path = '/';
  }
  return {
    title: tab.title ?? '',
    url,
    domain,
    path,
    capturedAt: Date.now(),
  };
}
