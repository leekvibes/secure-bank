interface Props {
  size?: "sm" | "md";
}

export function BrandLogo({ size = "sm" }: Props) {
  const wordSize = size === "md" ? "text-3xl" : "text-lg";
  const sloganSize = size === "md" ? "text-[9px] tracking-[3.5px] mt-2" : "text-[7.5px] tracking-[2.5px] mt-1";

  return (
    <div className="flex flex-col items-center leading-none select-none">
      <div className={`font-extrabold ${wordSize} leading-none`} style={{ letterSpacing: "-0.5px" }}>
        <span style={{ color: "#0F172A" }}>Secure</span>
        <span style={{ color: "#00A3FF" }}>Link</span>
      </div>
      <div
        className={`font-mono uppercase ${sloganSize}`}
        style={{ color: "#00A3FF" }}
      >
        SECURE. SIMPLE. FAST.
      </div>
    </div>
  );
}
