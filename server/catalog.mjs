// Ataraxia Cinema catalogue — server-side source of truth.
// `preview` is the short (5.2s) free loop shipped in the public build;
// `file` is the 21x-extended (109.3s) master that lives OUTSIDE the web root
// and is only streamable through the gated /api/media/:id endpoint.
export const PRICE_ATOMIC = 100000n; // 0.1 USDC (6 decimals)
export const USDC_DECIMALS = 6;

const B = (s) => `/videos/${s}`;
// Free previews are 720p re-encodes (~1-2.5 MB) of the 5.2 s originals so that
// tapping a preview does not pull the full-size master; the originals stay in
// ../legacy-backup/preview-originals and on Drive.
const P = (s) => `/videos/previews/${s}`;

export const CATALOG = [
  {
    id: 'helixhdna',
    title: 'HeliXHDNA',
    subtitle: 'helical drift',
    file: 'HeliXHDNA_21x.mp4',
    preview: P('helixhdna.mp4'),
    poster: B('posters/helixhdna.jpg'),
    durationSec: 109.33,
    previewSec: 5.21,
    priceAtomic: PRICE_ATOMIC.toString(),
  },
  {
    id: 'rotate21x',
    title: 'Rotate21x',
    subtitle: 'slow turning',
    file: 'Rotate21x_21x.mp4',
    preview: P('rotate21x.mp4'),
    poster: B('posters/rotate21x.jpg'),
    durationSec: 109.33,
    previewSec: 5.21,
    priceAtomic: PRICE_ATOMIC.toString(),
  },
  {
    id: 'wrap',
    title: 'Wrap',
    subtitle: 'fold and unfold',
    file: 'Wrap_21x.mp4',
    preview: P('wrap.mp4'),
    poster: B('posters/wrap.jpg'),
    durationSec: 109.33,
    previewSec: 5.21,
    priceAtomic: PRICE_ATOMIC.toString(),
  },
  {
    id: 'wraprotate',
    title: 'WrapRotate21xHeliXHDNA',
    subtitle: 'the long weave',
    file: 'WrapRotate21xHeliXHDNA_21x.mp4',
    preview: P('wraprotate.mp4'),
    poster: B('posters/wraprotate.jpg'),
    durationSec: 109.33,
    previewSec: 5.21,
    priceAtomic: PRICE_ATOMIC.toString(),
  },
];

export const catalogById = (id) => CATALOG.find((c) => c.id === id) || null;

/** Public (non-secret) catalogue for the UI. */
export const publicCatalog = () =>
  CATALOG.map(({ id, title, subtitle, preview, poster, durationSec, previewSec, priceAtomic }) => ({
    id, title, subtitle, preview, poster, durationSec, previewSec, priceAtomic,
  }));
