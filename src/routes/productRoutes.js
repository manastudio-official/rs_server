import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductBySlug,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkUpdateStock,
  getCategories,
  getBrands,
  getTags
} from '../controllers/productController.js';
import { protect, checkPermission } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/brands', getBrands);
router.get('/tags', getTags);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProductById);

// Admin routes
router.post('/', 
  protect, 
  checkPermission('products_write'), 
  upload.array('images', 5), 
  createProduct
);

router.put('/:id', 
  protect, 
  checkPermission('products_write'), 
  upload.array('images', 5), 
  updateProduct
);

router.delete('/:id', 
  protect, 
  checkPermission('products_delete'), 
  deleteProduct
);

router.patch('/bulk/stock',
  protect,
  checkPermission('products_write'),
  bulkUpdateStock
);



export default router;
