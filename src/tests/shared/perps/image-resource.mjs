// The same OneKey CDN image is rendered raw in SVG QR logos and resized in
// NetworkAvatar. Strip only the observed image transformation parameter;
// preserve origin, pathname and all unrelated query identity.
export function imageResourceIdentity(value) {
  const url = new URL(value);
  url.searchParams.delete('x-tos-process');
  return url.href;
}
