import mongoose from 'mongoose';
import { songSchema } from './User.js';

const voiceSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    durationMs: { type: Number, required: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'song', 'voice'], default: 'text' },
    text: { type: String, default: '', maxlength: 2000 },
    image: { type: String, default: '' },
    song: { type: songSchema, default: undefined },
    // Voice message: the audio itself lives in GridFS and is only streamed to the two people in the chat
    voice: { type: voiceSchema, default: undefined },
    read: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
schema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.voice) ret.voice = { durationMs: ret.voice.durationMs, mime: ret.voice.mime }; // never expose the storage id
    delete ret.__v;
    return ret;
  },
});
schema.index({ from: 1, to: 1, createdAt: -1 });
schema.index({ to: 1, read: 1 });

export const Message = mongoose.model('Message', schema);
