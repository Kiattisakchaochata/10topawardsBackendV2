// src/routes/public/search.public.routes.js
import express from 'express';
import { searchAll } from '../../controllers/search.controller.js';

const router = express.Router();
router.get('/', searchAll);

export default router;