// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit", "jspdf", "fflate"],
  allowedDevOrigins: ['100.85.88.114'],
};

export default nextConfig;
