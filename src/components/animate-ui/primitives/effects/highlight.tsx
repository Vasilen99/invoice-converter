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
  enabled: _enabled = true,
  hover: _hover = false,
  controlledItems: _controlledItems = false,
  mode: _mode,
  containerClassName,
  forceUpdateBounds: _forceUpdateBounds = false,
  transition: _transition,
}: HighlightProps) => {
  return <div className={containerClassName}>{children}</div>;
};

export const HighlightItem = ({
  children,
  activeClassName,
}: HighlightItemProps) => {
  return <div className={activeClassName}>{children}</div>;
};
