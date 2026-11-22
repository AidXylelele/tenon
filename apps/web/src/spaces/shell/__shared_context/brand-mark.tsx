import { PRODUCT_NAME } from "@/libs/routing/page-title";

export function BrandMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="size-8 shrink-0"
    >
      <path d="M0 0H16V5H10V10H6V5H0Z" />
      <path d="M0 6H5V11H11V6H16V16H0Z" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <span className="flex items-center gap-2 text-foreground">
      <BrandMark />
      <span className="heading-1">{PRODUCT_NAME}</span>
    </span>
  );
}
