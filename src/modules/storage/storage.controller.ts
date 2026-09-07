import { Router } from 'express';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validator.js';
import { createUploadUrlSchema, downloadUrlQuerySchema } from './storage.schema.js';
import { StorageService } from './storage.service.js';

const router = Router();

router.post(
  '/upload-url',
  requireAuth,
  validateBody(createUploadUrlSchema),
  ah(async (req, res) => {
    const result = await StorageService.createUploadUrl(
      req.user!.userId,
      req.body.file_name,
      req.body.content_type,
      req.body.byte_size,
      req.body.category
    );
    res.status(201).json(result);
  })
);

router.get(
  '/download-url',
  requireAuth,
  validateQuery(downloadUrlQuerySchema),
  ah(async (req, res) => {
    const result = await StorageService.createDownloadUrl(
      String(req.query.key),
      req.user!.userId,
      req.user!.role
    );
    res.json(result);
  })
);

export default router;
