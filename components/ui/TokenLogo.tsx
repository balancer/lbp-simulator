"use client";

import * as React from "react";
import { CollateralToken } from "@/lib/lbp-math";

interface TokenLogoProps {
  token: CollateralToken | string;
  size?: number;
  className?: string;
}

const EthLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="800px"
    height="800px"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g fill="none" fillRule="evenodd">
      <circle cx={16} cy={16} r={16} fill="#627EEA" />
      <g fill="#FFF" fillRule="nonzero">
        <path fillOpacity={0.602} d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4L9 16.22l7.498-3.35z" />
        <path fillOpacity={0.602} d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity={0.2} d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity={0.602} d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
    </g>
  </svg>
);

// Inline SVGs (no remote fetch). Built to resemble common token logos.
// Reference URLs (for shape/branding): cryptologos.cc (USDC/USDT).
const UsdcLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      fill="#2775CA"
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"
    />
    <path
      fill="#fff"
      d="M13.62 5.45v1.159a5.64 5.64 0 0 1 4.005 5.394 5.64 5.64 0 0 1-4.005 5.394v1.16a6.74 6.74 0 0 0 5.13-6.554 6.74 6.74 0 0 0-5.13-6.553m-7.245 6.553a5.64 5.64 0 0 1 4.005-5.394V5.45a6.74 6.74 0 0 0-5.13 6.553 6.74 6.74 0 0 0 5.13 6.553v-1.159a5.63 5.63 0 0 1-4.005-5.394"
    />
    <path
      fill="#fff"
      d="M14.419 13.258c0-2.301-3.606-1.356-3.606-2.627 0-.456.366-.748 1.063-.748.833 0 1.12.405 1.21.95h1.147c-.102-1.024-.69-1.67-1.67-1.863v-.904h-1.125v.872c-1.075.137-1.75.762-1.75 1.693 0 2.312 3.611 1.445 3.611 2.694 0 .472-.455.787-1.226.787-1.007 0-1.339-.444-1.462-1.057H9.49c.073 1.122.764 1.823 1.947 1.999v.886h1.125v-.875c1.153-.149 1.856-.82 1.856-1.807"
    />
  </svg>
);

const UsdtLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      fill="#fff"
      d="M8 9.2h16v3H18.6v2.1c3.55.2 6.1.9 6.1 1.82 0 1.11-3.9 2.01-8.7 2.01s-8.7-.9-8.7-2.01c0-.92 2.55-1.62 6.1-1.82v-2.1H8z"
    />
    <path fill="#fff" d="M14.4 12.2h3.2v11.2h-3.2z" />
    <path fill="#fff" d="M11 13.9h10v2H11z" />
    <ellipse
      cx="16"
      cy="18.4"
      rx="8.7"
      ry="3.25"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      opacity="0.95"
    />
    <path
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.95"
      d="M10 18.4h12"
    />
    <path
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.95"
      d="M11.3 20.2h9.4"
    />
  </svg>
);

export function TokenLogo({ token, size = 24, className = "" }: TokenLogoProps) {
  // Handle ETH and wETH with inline SVG
  if (token === "ETH" || token === "wETH") {
    return (
      <div
        className={`rounded-full overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <EthLogo 
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  if (token === "USDC" || token === "USDT") {
    const Logo = token === "USDC" ? UsdcLogo : UsdtLogo;
    return (
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <Logo className="w-full h-full" style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }

  // Fallback to first letter if token not found (for project tokens)
  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground ${className}`}
      style={{ width: size, height: size }}
    >
      {token[0]?.toUpperCase() || "?"}
    </div>
  );
}
