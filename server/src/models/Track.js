import mongoose from 'mongoose';

// One uploaded song. The audio bytes live in MongoDB GridFS (bucket "audio"); `fileId` points at them.
const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    playlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    artist: { type: String, default: '', trim: true, maxlength: 100 },
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    durationMs: { type: Number, required: true, min: 1000 },
  },
  { timestamps: true }
);
schema.index({ playlist: 1, createdAt: 1 });

export const Track = mongoose.model('Track', schema);
