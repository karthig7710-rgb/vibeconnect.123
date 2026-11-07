import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listRoomsFor } from '../rooms/manager.js';

const router = Router();
router.use(requireAuth);
router.get('/', (req, res) => res.json({ rooms: listRoomsFor(req.user.id) }));
export default router;
