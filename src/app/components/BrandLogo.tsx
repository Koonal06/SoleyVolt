type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "h-12 w-12", alt = "SoleyVolt logo" }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} className={className} />;
}
