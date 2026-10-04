import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF/DOCX parsing and the AWS SDK unbundled on the server
  serverExternalPackages: ["unpdf", "mammoth", "@aws-sdk/client-s3"],
};

export default nextConfig;
