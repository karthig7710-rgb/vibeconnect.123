import mongoose from 'mongoose';

// Only pending requests are stored; accepting or declining deletes the document.
const schema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
schema.index({ from: 1, to: 1 }, { unique: true });
schema.index({ to: 1 });

export const FriendRequest = mongoose.model('FriendRequest', schema);
