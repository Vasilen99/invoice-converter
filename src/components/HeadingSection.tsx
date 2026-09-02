import { FadeIn } from "./motion";

export const HeadingSection = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => {
  return (
    <FadeIn className="text-start mb-10">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-4">
        {title}
      </h2>
      <p className="text-muted-foreground text-base">{subtitle}</p>
    </FadeIn>
  );
};
