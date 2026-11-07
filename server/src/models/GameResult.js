import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    type: { type: String, enum: ['ttt', 'c4', 'rps'], required: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    draw: { type: Boolean, default: false },
    reason: { type: String, default: 'normal' },
  },
  { timestamps: true }
);
schema.index({ players: 1, createdAt: -1 });

export const GameResult = mongoose.model('GameResult', schema);
