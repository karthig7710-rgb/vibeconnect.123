import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 200 },
    // private = only the owner, friends = the owner's friends, public = every VibeConnect user
    visibility: { type: String, enum: ['private', 'friends', 'public'], default: 'friends' },
  },
  { timestamps: true }
);
schema.index({ visibility: 1, updatedAt: -1 });

export const Playlist = mongoose.model('Playlist', schema);
