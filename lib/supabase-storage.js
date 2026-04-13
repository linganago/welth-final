/**
 * Receipt image storage via Supabase Storage.
 *
 * Setup (one-time):
 *   1. Go to Supabase dashboard → Storage → Create bucket named "receipts"
 *   2. Set bucket to PUBLIC (so receipt URLs are directly viewable)
 *   3. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env
 *
 * The service role key bypasses Row Level Security — it is SERVER-SIDE ONLY.
 * Never expose it to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import logger from "./logger";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add them to your .env file."
    );
  }

  return createClient(url, key);
}

/**
 * Uploads a receipt file to Supabase Storage and returns the public URL.
 *
 * The file is stored at: receipts/<userId>/<timestamp>.<extension>
 * This path structure keeps receipts grouped by user and avoids collisions.
 *
 * @param {File}   file    The File object from the form upload
 * @param {string} userId  Internal DB user id (used as folder name)
 * @returns {Promise<string>}  Public URL of the uploaded file
 */
export async function uploadReceipt(file, userId) {
  const supabase = getSupabaseClient();

  // Extract extension from MIME type (image/jpeg → jpg, image/png → png)
  const mimeToExt = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  const ext = mimeToExt[file.type] ?? "jpg";
  const filename = `${userId}/${Date.now()}.${ext}`;

  // Convert File → ArrayBuffer → Buffer for Supabase upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data, error } = await supabase.storage
    .from("receipts")
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
      // Cache receipts for 1 year — they are immutable once uploaded
      cacheControl: "31536000",
    });

  if (error) {
    logger.error("Receipt upload failed", error, { userId, filename });
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  // Get the public URL for the uploaded file
  const { data: urlData } = supabase.storage
    .from("receipts")
    .getPublicUrl(data.path);

  logger.info("Receipt uploaded", { userId, path: data.path });

  return urlData.publicUrl;
}

/**
 * Deletes a receipt from Supabase Storage by its public URL.
 * Called when a transaction is deleted.
 *
 * @param {string} publicUrl  The public URL returned by uploadReceipt
 */
export async function deleteReceipt(publicUrl) {
  if (!publicUrl) return;

  try {
    const supabase = getSupabaseClient();

    // Extract the storage path from the public URL
    // URL format: https://<project>.supabase.co/storage/v1/object/public/receipts/<path>
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split("/receipts/");
    if (pathParts.length < 2) return;

    const storagePath = pathParts[1];

    const { error } = await supabase.storage
      .from("receipts")
      .remove([storagePath]);

    if (error) {
      logger.warn("Receipt deletion failed (non-fatal)", { publicUrl, error: error.message });
    }
  } catch (err) {
    // Deletion failure is non-fatal — log and continue
    logger.warn("Receipt deletion error (non-fatal)", { publicUrl });
  }
}
