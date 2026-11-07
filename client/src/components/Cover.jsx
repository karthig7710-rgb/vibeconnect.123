import { Music2 } from 'lucide-react';

// Song artwork. Uploaded songs have no artwork, so they get a coloured tile with a music note.
export default function Cover({ src, className = '', iconSize = 20 }) {
  if (src) return <img src={src} alt="" className={`object-cover ${className}`} loading="lazy" />;
  return (
    <span className={`grid shrink-0 place-items-center bg-gradient-to-br from-vibe to-vibe-pink text-white ${className}`} aria-hidden>
      <Music2 size={iconSize} />
    </span>
  );
}
