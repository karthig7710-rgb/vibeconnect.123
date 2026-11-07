import mongoose from 'mongoose';

let bucket;
export function getBucket() {
  if (!bucket) bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'audio' });
  return bucket;
}

export function putBuffer(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const up = getBucket().openUploadStream(filename, { contentType });
    up.on('error', reject);
    up.on('finish', () => resolve(up.id));
    up.end(buffer);
  });
}

export async function removeFile(id) {
  try {
    await getBucket().delete(id);
  } catch {
    /* already gone */
  }
}
