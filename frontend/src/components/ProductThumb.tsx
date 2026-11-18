import { productTone } from "../lib/format";

/** Product photo, or an earthy colour block until the farmer adds one. */
export function ProductThumb({
  name,
  imageUrl,
  className = "",
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return <img className={`thumb ${className}`} src={imageUrl} alt={name} loading="lazy" />;
  }
  return (
    <div
      className={`thumb thumb--empty ${className}`}
      style={{ background: productTone(name) }}
      role="img"
      aria-label={`${name}, no photo yet`}
    />
  );
}
