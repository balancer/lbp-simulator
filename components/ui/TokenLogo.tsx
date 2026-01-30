"use client";

import * as React from "react";
import { CollateralToken } from "@/lib/lbp-math";
import Image from "next/image";

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

const TOKEN_LOGOS: Record<string, string> = {
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=002"
};

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

  const logoUrl = TOKEN_LOGOS[token];

  if (logoUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center  ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={logoUrl}
          alt={token}
          width={size}
          height={size}
          className="object-contain"
          unoptimized
        />
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
