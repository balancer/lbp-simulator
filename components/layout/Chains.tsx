"use client";

import {
  NetworkArbitrumOne,
  NetworkAvalanche,
  NetworkBase,
  NetworkEthereum,
  NetworkGnosis,
  NetworkHyperEvm,
  NetworkMonad,
  NetworkOptimism,
  NetworkPlasma,
} from "@web3icons/react";

const CHAINS = [
  { name: "Ethereum Mainnet", Icon: NetworkEthereum, glow: "#627EEA" },
  { name: "Arbitrum", Icon: NetworkArbitrumOne, glow: "#2D374B" },
  { name: "Avalanche (C-Chain)", Icon: NetworkAvalanche, glow: "#E84142" },
  { name: "Optimism", Icon: NetworkOptimism, glow: "#FF0420" },
  { name: "Base", Icon: NetworkBase, glow: "#0052FF" },
  { name: "HyperVM", Icon: NetworkHyperEvm, glow: "#50D2C1" },
  { name: "Monad", Icon: NetworkMonad, glow: "#836EF9" },
  {
    name: "Gnosis Chain / related EVM chains",
    Icon: NetworkGnosis,
    glow: "#00A16F",
  },
  { name: "Plasma", Icon: NetworkPlasma, glow: "#F9A826" },
];

export function Chains() {
  return (
    <section className="w-full container mx-auto max-w-5xl px-4 md:px-6 mt-12 md:mt-16">
      <div className="flex flex-col items-center text-center gap-6">
        <h3 className="text-xl md:text-2xl font-semibold text-foreground">
          Supported Chains
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {CHAINS.map((chain) => (
            <div
              key={chain.name}
              className="group relative flex flex-col items-center gap-2"
              title={chain.name}
            >
              <div
                className="absolute h-16 w-16 md:h-[72px] md:w-[72px] rounded-full opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-100"
                style={{
                  boxShadow: `0 0 28px ${chain.glow}`,
                }}
              />
              <div className="h-16 w-16 md:h-[72px] md:w-[72px] rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <chain.Icon
                  variant="mono"
                  className="h-12 w-12 md:h-14 md:w-14 text-foreground dark:text-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
