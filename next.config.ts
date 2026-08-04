import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Profiles live at maxpoll.vercel.app/@handle (doc 03 §J), but a folder
      // starting with `@` is the App Router's *parallel route slot* convention —
      // `app/@[handle]` would be a named slot and would never serve a URL.
      // So the page lives at /u/[handle] and this keeps the public URL pretty.
      { source: "/@:handle", destination: "/u/:handle" },
    ];
  },
};

export default nextConfig;
