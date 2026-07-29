import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

export const certificateKey = (cardId: string): string => `certificates/${cardId}.pdf`;

/** Store a generated certificate PDF (private, SSE) for later buyer download. */
export async function storeCertificate(
  bucket: string,
  cardId: string,
  pdf: Uint8Array,
): Promise<string> {
  const key = certificateKey(cardId);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );
  return key;
}

/** Fetch a stored certificate as bytes (for the buyer download endpoint). */
export async function getCertificate(bucket: string, cardId: string): Promise<Uint8Array | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: certificateKey(cardId) }),
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ?? null;
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}
