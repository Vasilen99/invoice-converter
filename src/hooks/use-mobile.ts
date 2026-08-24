import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(resolution: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${resolution - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < resolution);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < resolution);
    return () => mql.removeEventListener("change", onChange);
  }, [resolution]);

  return !!isMobile;
}
