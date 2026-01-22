import { 
    PutObjectCommand, 
    DeleteObjectCommand, 
    GetObjectCommand 
  } from '@aws-sdk/client-s3';
  import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
  import s3Client from '../config/aws.js';
  import sharp from 'sharp';
  import crypto from 'crypto';
  import logger from './logger.js';
  
  export const uploadToS3 = async (file, folder = 'products') => {
    try {
      // Process image with sharp - optimize for web
      const processedImage = await sharp(file.buffer)
        .resize(1200, 1200, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .webp({ quality: 85 })
        .toBuffer();
  
      // Generate unique filename
      const fileName = `${folder}/${crypto.randomBytes(16).toString('hex')}-${Date.now()}.webp`;
  
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileName,
        Body: processedImage,
        ContentType: 'image/webp',
        CacheControl: 'max-age=31536000',
      };
  
      await s3Client.send(new PutObjectCommand(params));
  
      const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  
      logger.info(`Image uploaded to S3: ${fileName}`);
  
      return {
        url,
        key: fileName
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error('Failed to upload image to S3');
    }
  };
  
  export const deleteFromS3 = async (key) => {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      };
  
      await s3Client.send(new DeleteObjectCommand(params));
      logger.info(`Image deleted from S3: ${key}`);
      return true;
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error('Failed to delete image from S3');
    }
  };
  
  export const getSignedS3Url = async (key, expiresIn = 3600) => {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      });
  
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      logger.error('Get signed URL error:', error);
      throw new Error('Failed to generate signed URL');
    }
  };
  
  export const uploadMultipleToS3 = async (files, folder = 'products') => {
    try {
      const uploadPromises = files.map(file => uploadToS3(file, folder));
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      logger.error('Multiple S3 upload error:', error);
      throw new Error('Failed to upload multiple images');
    }
  };
  