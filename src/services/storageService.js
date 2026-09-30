/**
 * Object storage service — uploads buffers to whichever S3-compatible
 * provider is configured (AWS S3, Cloudflare R2, or Supabase Storage all
 * speak the S3 API, so one client covers all three per STORAGE_PROVIDER).
 *
 * Used for: TTS audio files generated for the voice coach, and user avatar
 * uploads. Returns null when storage isn't configured, so callers can
 * degrade gracefully (e.g. skip TTS audio, or reject avatar uploads with a
 * clear error) instead of crashing.
 */

let s3Client = null;
function getClient() {
  if (s3Client) return s3Client;
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) return null;

  // Lazy-require so the app still boots if @aws-sdk isn't installed and
  // storage simply isn't configured.
  const { S3Client } = require("@aws-sdk/client-s3");

  s3Client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined, // set for R2/Supabase; omit for real AWS S3
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: !!process.env.S3_ENDPOINT, // required by R2/Supabase-style endpoints
  });
  return s3Client;
}

function isConfigured() {
  return !!getClient();
}

/**
 * Uploads a buffer to the configured bucket under `key` and returns its
 * public URL. Assumes the bucket/CDN is configured for public read access
 * on the given key prefix — adjust ACL/signing here if you need private,
 * signed URLs instead.
 */
async function uploadBuffer(key, buffer, contentType) {
  const client = getClient();
  if (!client) {
    throw new Error(
      "Object storage is not configured (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env)"
    );
  }

  const { PutObjectCommand } = require("@aws-sdk/client-s3");

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  if (process.env.S3_PUBLIC_URL_BASE) {
    return `${process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
  }
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${process.env.S3_BUCKET}/${key}`;
  }
  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com/${key}`;
}

module.exports = { uploadBuffer, isConfigured };
