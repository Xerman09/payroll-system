import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit"],
};

module.exports = nextConfig;


export default nextConfig;
