/** Small embedded map preview for a delivery address (no API key). */
export function AddressMapPreview({
  addressLine1,
  addressLine2,
}: {
  addressLine1: string;
  addressLine2: string;
}) {
  const query = encodeURIComponent(`${addressLine1}, ${addressLine2}`);
  const src = `https://www.google.com/maps?q=${query}&z=15&output=embed`;

  return (
    <div className="mt-3 overflow-hidden border border-line bg-bg-subtle">
      <iframe
        title={`Map preview for ${addressLine1}`}
        src={src}
        className="block h-36 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
