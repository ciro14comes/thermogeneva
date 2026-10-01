// Dati strutturati schema.org (JSON-LD) per motori di ricerca e assistenti AI.
export default function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // "<" viene escapato per evitare la chiusura prematura del tag script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
