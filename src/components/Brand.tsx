import Image from "next/image";
export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <Image src="/brand/mark.svg" alt="" width={36} height={36} unoptimized />
      <span>
        <span className="brand-eyebrow">FACILITIES</span>
        <span className="brand-name">
          Safety Desk<span className="brand-period">.</span>
        </span>
      </span>
    </span>
  );
}
