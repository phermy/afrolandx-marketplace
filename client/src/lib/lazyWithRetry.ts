import { lazy, type ComponentType } from "react";

type ModuleWithDefault<T extends ComponentType<any>> = { default: T };

/**
 * Make a single best-effort retry for transient chunk fetch failures. If that
 * retry also fails, React's error boundary offers a full reload recovery.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<ModuleWithDefault<T>>,
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstError) {
      await new Promise(resolve => window.setTimeout(resolve, 250));
      try {
        return await importer();
      } catch {
        throw firstError;
      }
    }
  });
}
