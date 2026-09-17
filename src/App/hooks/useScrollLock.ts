import { RefObject, useEffect } from "react";

interface UseScrollLockOptions {
  enabled: boolean;
  allowedRef?: RefObject<HTMLElement | null>;
}

export function useScrollLock({ enabled, allowedRef }: UseScrollLockOptions) {
  useEffect(() => {
    if (!enabled) return;

    const isInsideAllowedContent = (target: EventTarget | null) =>
      allowedRef?.current?.contains(target as Node) ?? false;

    const preventScroll = (event: Event) => {
      if (!isInsideAllowedContent(event.target)) {
        event.preventDefault();
      }
    };

    const preventKeyScroll = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isEditable) {
        return;
      }

      if (
        !isInsideAllowedContent(event.target) &&
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", " "].includes(event.key)
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", preventScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", preventScroll, { capture: true, passive: false });
    document.addEventListener("keydown", preventKeyScroll, { capture: true });

    return () => {
      document.removeEventListener("wheel", preventScroll, true);
      document.removeEventListener("touchmove", preventScroll, true);
      document.removeEventListener("keydown", preventKeyScroll, true);
    };
  }, [enabled, allowedRef]);
}