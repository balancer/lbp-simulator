export function SvgDefinitions() {
  return (
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <linearGradient
          id="demand-pressure-gradient"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop offset="0%" stopColor="#91E2C1" />
          <stop offset="50%" stopColor="#05D690" />
          <stop offset="100%" stopColor="#18B575" />
        </linearGradient>
      </defs>
    </svg>
  );
}
