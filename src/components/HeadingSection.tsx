import { FadeIn } from "./motion";

export const HeadingSection = ({
  title,
  subtitle,
  type,
}: {
  title: string;
  subtitle?: string;
  type: "landing-section" | "inner-page";
}) => {
  const mainContainerClass =
    type === "landing-section" ? "text-center mb-14" : "text-start mb-10";
  const h2Style =
    type === "landing-section"
      ? "text-3xl lg:text-5xl"
      : "text-2xl lg:text-3xl";
  const pStyle =
    type === "landing-section"
      ? "text-lg text-muted-foreground max-w-2xl mx-auto"
      : "text-muted-foreground text-base";
  return (
    <FadeIn className={mainContainerClass}>
      <h2
        className={`font-black tracking-tight text-foreground mb-4 ${h2Style}`}
      >
        {title}
      </h2>
      {subtitle && <p className={pStyle}>{subtitle}</p>}
    </FadeIn>
  );
};
