import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the "N" dev-tools badge in the corner during `next dev`; build and
  // runtime errors are still shown as overlays.
  devIndicators: false,
};

export default nextConfig;
