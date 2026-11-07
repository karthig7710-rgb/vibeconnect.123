import mongoose from 'mongoose';
import { THEME_IDS, DEFAULT_THEME } from '../utils/themes.js';
import { isPremium, effectiveTemplates } from '../utils/plans.js';

export const songSchema = new mongoose.Schema(
  {
    trackId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 300 },
    artist: { type: String, default: '', maxlength: 300 },
    album: { type: String, default: '', maxlength: 300 },
    artwork: { type: String, default: '' },
    previewUrl: { type: String, required: true },
    trackUrl: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 160 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    favorites: [songSchema],
    lastSeen: { type: Date, default: Date.now },

    // Free app theme (see utils/themes.js). Unknown/legacy values fall back to the default on the client.
    theme: { type: String, enum: THEME_IDS, default: DEFAULT_THEME },

    // Free / Premium. Payments are not connected: premium is granted by the app owner (PREMIUM_USERNAMES or premiumUntil).
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    premiumUntil: { type: Date, default: null },
    // Chosen chat / call / profile templates (validated against utils/plans.js)
    templates: {
      chat: { type: String, default: 'classic' },
      call: { type: String, default: 'plain' },
      profile: { type: String, default: 'classic' },
    },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.plan;
    delete ret.premiumUntil;
    if (doc.plan !== undefined) { // only on full documents, not partially-selected friend lists
      ret.isPremium = isPremium(doc);
      ret.templates = effectiveTemplates(doc);
    } else {
      delete ret.templates;
    }
    return ret;
  },
});

export const PUBLIC_FIELDS = 'username avatar bio lastSeen';
export const User = mongoose.model('User', userSchema);
