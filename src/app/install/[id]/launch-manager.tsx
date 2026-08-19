"use client";

import { useEffect } from "react";

export function LaunchManager({ url }: { url: string }) {
  useEffect(() => {
    window.location.href = url;
  }, [url]);
  return null;
}
