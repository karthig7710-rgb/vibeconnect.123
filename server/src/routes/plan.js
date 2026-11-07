import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError } from '../utils/errors.js';
import { TEMPLATES, FILTERS, VOICES, isPremium, validTemplate, effectiveTemplates } from '../utils/plans.js';

const router = Router();
router.use(requireAuth);

// GET /api/plan -> what this user has, plus the full catalogue (true = Premium only)
router.get('/', ah(async (req, res) => {
  res.json({
    isPremium: isPremium(req.user),
    templates: effectiveTemplates(req.user),
    catalog: { filters: FILTERS, voices: VOICES, templates: TEMPLATES },
  });
}));

// PUT /api/plan/templates { chat?, call?, profile? }
const schema = z.object({ chat: z.string().max(20).optional(), call: z.string().max(20).optional(), profile: z.string().max(20).optional() }).strict();
router.put('/templates', ah(async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) throw new HttpError(400, 'Invalid template.');
  const premium = isPremium(req.user);
  for (const [kind, id] of Object.entries(p.data)) {
    if (!validTemplate(kind, id)) throw new HttpError(400, 'Unknown template.');
    if (TEMPLATES[kind][id] && !premium) throw new HttpError(403, 'That template is part of Premium.');
    req.user.set(`templates.${kind}`, id);
  }
  await req.user.save();
  res.json({ user: req.user.toJSON() });
}));

export default router;
