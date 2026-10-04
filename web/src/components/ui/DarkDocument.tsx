"use client";

import { useEffect } from "react";

/** Puts the whole document in the dark theme (so overscroll areas match too). */
export function DarkDocument() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = "dark";
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, []);
  return null;
}
