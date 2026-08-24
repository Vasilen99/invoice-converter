import React from "react";
import { type Transition } from "motion/react";

/**
 * Highlight component for animate-ui
 * Used internally by the sidebar for visual effects
 */
interface HighlightProps {
  children: React.ReactNode;
  enabled?: boolean;
  hover?: boolean;
  controlledItems?: boolean;
  mode?: string;
  containerClassName?: string;
  forceUpdateBounds?: boolean;
  transition?: Transition;
}

interface HighlightItemProps {
  children: React.ReactNode;
  activeClassName?: string;
}

export const Highlight = ({
  children,
  enabled = true,
  hover = false,
  controlledItems = false,
  mode,
  containerClassName,
  forceUpdateBounds = false,
  transition,
}: HighlightProps) => {
  return <div className={containerClassName}>{children}</div>;
};

export const HighlightItem = ({
  children,
  activeClassName,
}: HighlightItemProps) => {
  return <div className={activeClassName}>{children}</div>;
};
