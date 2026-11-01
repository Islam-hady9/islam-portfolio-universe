'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Renders the build year on the server and the visitor's current year after hydration. */
export function CurrentYear({ buildYear }: { buildYear: number }) {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => buildYear,
  );
  return <>{year}</>;
}
