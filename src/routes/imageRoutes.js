import express from 'express';
import { upload } from '../middlewares/upload.js';

import {
  uploadToS3,
  uploadMultipleToS3,
  deleteFromS3,
  getSignedS3Url,
} from '../utils/s3Upload.js';

const router = express.Router();

/**
 * @route   POST /api/images/upload
 * @desc    Upload single image
 * @access  Public / Protected (your choice)
 */
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const folder = req.body.folder || 'products';

    const result = await uploadToS3(req.file, folder);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/images/upload-multiple
 * @desc    Upload multiple images
 */
router.post('/upload-multiple', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: 'Images are required' });
    }

    const folder = req.body.folder || 'products';

    const results = await uploadMultipleToS3(req.files, folder);

    res.status(201).json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/images/delete
 * @desc    Delete image from S3
 */
router.delete('/delete', async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ message: 'S3 key is required' });
    }

    await deleteFromS3(key);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/images/signed-url
 * @desc    Get signed S3 URL
 */
router.get('/signed-url', async (req, res) => {
  try {
    const { key, expiresIn } = req.query;

    if (!key) {
      return res.status(400).json({ message: 'S3 key is required' });
    }

    const url = await getSignedS3Url(key, Number(expiresIn) || 3600);

    res.status(200).json({
      success: true,
      url,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
