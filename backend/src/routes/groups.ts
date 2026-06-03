import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireGroupMember, requireGroupAdmin } from '../middleware/groupAuth';
import {
  getGroups,
  createGroup,
  getGroupById,
  addMember,
  removeMember,
} from '../controllers/groupController';

const router = Router();

// Apply auth verifyToken globally to all group routes
router.use(verifyToken);

// Fetch all groups where user is a member
router.get('/', getGroups);

// Create a new group
router.post('/', createGroup);

// Get specific group details (must be a member)
router.get('/:id', requireGroupMember, getGroupById);

// Add a member to a group (must be an admin)
router.post('/:id/members', requireGroupAdmin, addMember);

// Remove a member from a group (must be an admin)
router.delete('/:id/members/:userId', requireGroupAdmin, removeMember);

export default router;
