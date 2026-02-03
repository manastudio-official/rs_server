import Product from "../models/Product.js";
import {
  uploadToS3,
  deleteFromS3,
  uploadMultipleToS3,
} from "../utils/s3Upload.js";
import { successResponse, AppError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

// Create product
export const createProduct = async (req, res, next) => {
  try {
    const productData = req.body;

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const uploadedImages = await uploadMultipleToS3(req.files, "products");
      productData.images = uploadedImages.map((img, index) => ({
        url: img.url,
        key: img.key,
        alt: req.body.imageAlts?.[index] || productData.name,
      }));
    }

    // Parse tags if sent as string
    if (productData.tags) {
      if (typeof productData.tags === "string") {
        productData.tags = productData.tags.split(",").map((tag) => tag.trim());
      } else if (Array.isArray(productData.tags)) {
        productData.tags = productData.tags.map((tag) => tag.trim());
      }
    }

    // Parse seo if sent as nested object string
    if (productData.seo) {
      if (typeof productData.seo === "string") {
        try {
          productData.seo = JSON.parse(productData.seo);
        } catch (e) {
          logger.error("Error parsing seo:", e);
          delete productData.seo;
        }
      }
    }

    // Parse rating if sent as nested object string
    if (productData.rating) {
      if (typeof productData.rating === "string") {
        try {
          productData.rating = JSON.parse(productData.rating);
        } catch (e) {
          logger.error("Error parsing rating:", e);
          delete productData.rating;
        }
      }
    }
    if (productData.video_url) {
      if (typeof productData.rating === "string") {
        try {
          productData.video_url = JSON.parse(productData.video_url);
          productData.video_type = JSON.parse(productData.video_type);
        } catch (e) {
          logger.error("Error parsing rating:", e);
          delete productData.video_type;
          delete productData.video_url;
        }
      }
    }
    // Convert string booleans to actual booleans
    if (typeof productData.isActive === "string") {
      productData.isActive = productData.isActive === "true";
    }
    if (typeof productData.silkMarkcertified === "string") {
      productData.silkMarkcertified = productData.silkMarkcertified === "true";
    }

    // Convert string numbers to actual numbers
    const numericFields = ["price", "mrp", "stock"];
    numericFields.forEach((field) => {
      if (productData[field] && typeof productData[field] === "string") {
        productData[field] = parseFloat(productData[field]);
      }
    });

    // Create product
    const product = await Product.create(productData);

    logger.info(
      `Product created: ${product.name} (${product.sku}) by ${req.admin.username}`
    );

    successResponse(res, 201, product, "Product created successfully");
  } catch (error) {
    logger.error("Create product error:", error);
    next(error);
  }
};
// Get all products with filters
export const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      category,
      subcategory,
      collection,
      minPrice,
      maxPrice,
      search,
      tags,
      brand,
      stockStatus,
      featured,
    } = req.query;

    const query = { isActive: true };

    // Filters
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (collection) query.collection = collection;
    if (brand) query.brand = brand;
    if (featured === "true") query.silkMarkcertified = true;
    if (stockStatus) {
      if (stockStatus === "inStock") {
        query.stock = { $gt: 0 };
      } else if (stockStatus === "outOfStock") {
        query.stock = { $lte: 0 };
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        {category: { $regex: search, $options: "i" } },
        { subcategory: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (tags) {
      query.tags = { $in: tags.split(",").map((tag) => tag.trim()) };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).limit(parseInt(limit)).skip(skip).lean(),
      Product.countDocuments(query),
    ]);

    successResponse(res, 200, {
      products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single product by slug
export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Increment views
    product.views += 1;
    await product.save({ validateBeforeSave: false });

    successResponse(res, 200, product);
  } catch (error) {
    next(error);
  }
};

// Get product by ID
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    successResponse(res, 200, product);
  } catch (error) {
    next(error);
  }
};

// Update product
export const updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      // Delete old images from S3
      if (product.images && product.images.length > 0) {
        await Promise.all(product.images.map((img) => deleteFromS3(img.key)));
      }

      const uploadedImages = await uploadMultipleToS3(req.files, "products");
      req.body.images = uploadedImages.map((img, index) => ({
        url: img.url,
        key: img.key,
        alt: req.body.imageAlts?.[index] || req.body.name || product.name,
      }));
    }

    // Parse tags if sent as string
    if (req.body.tags && typeof req.body.tags === "string") {
      req.body.tags = req.body.tags.split(",").map((tag) => tag.trim());
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    logger.info(`Product updated: ${product.name} by ${req.admin.username}`);

    successResponse(res, 200, product, "Product updated successfully");
  } catch (error) {
    next(error);
  }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Delete images from S3
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map((img) => deleteFromS3(img.key)));
    }

    await product.deleteOne();

    logger.info(`Product deleted: ${product.name} by ${req.admin.username}`);

    successResponse(res, 200, null, "Product deleted successfully");
  } catch (error) {
    next(error);
  }
};

// Bulk update stock
export const bulkUpdateStock = async (req, res, next) => {
  try {
    const { products } = req.body; // Array of { id, stock }

    if (!products || !Array.isArray(products)) {
      return next(new AppError("Please provide products array", 400));
    }

    const bulkOps = products.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { stock: item.stock } },
      },
    }));

    const result = await Product.bulkWrite(bulkOps);

    logger.info(
      `Bulk stock update: ${result.modifiedCount} products by ${req.admin.username}`
    );

    successResponse(res, 200, result, "Stock updated successfully");
  } catch (error) {
    next(error);
  }
};

// Get product categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });
    successResponse(res, 200, categories);
  } catch (error) {
    next(error);
  }
};

// Get product brands
export const getBrands = async (req, res, next) => {
  try {
    const brands = await Product.distinct("brand", { isActive: true });
    successResponse(res, 200, brands);
  } catch (error) {
    next(error);
  }
};

export const getTags = async (req, res, next) => {
  try {
    const { search } = req.query;

    const pipeline = [
      { $match: { isActive: true } },
      { $unwind: "$tags" },
    ];

    if (search) {
      pipeline.push({
        $match: {
          tags: { $regex: search, $options: "i" }
        }
      });
    }

    pipeline.push(
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 } }
    );

    const tags = await Product.aggregate(pipeline);

    const formattedTags = tags.map(t => ({
      label: t._id,
      value: t._id
    }));

    successResponse(res, 200, formattedTags);
  } catch (error) {
    next(error);
  }
};
