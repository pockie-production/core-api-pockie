import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private minioClient: Minio.Client;
  private readonly logger = new Logger(MinioService.name);
  private bucketName = 'ekyc-documents';

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'pockie-minio',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ROOT_USER || 'admin',
      secretKey: process.env.MINIO_ROOT_PASSWORD || 'pockie_minio_secret',
    });

    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created successfully.`);
      }
    } catch (err) {
      this.logger.error('Error initializing MinIO bucket', err);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    
    await this.minioClient.putObject(
      this.bucketName,
      fileName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );
    
    return fileName;
  }

  async getFileBuffer(fileName: string): Promise<Buffer> {
    const dataStream = await this.minioClient.getObject(this.bucketName, fileName);
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: any[] = [];
      dataStream.on('data', (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
      });
      dataStream.on('end', () => {
        resolve(Buffer.concat(chunks, size));
      });
      dataStream.on('error', (err) => {
        reject(err);
      });
    });
  }

  async getFileUrl(fileName: string): Promise<string> {
    // Generate a presigned URL valid for 1 hour
    return await this.minioClient.presignedGetObject(this.bucketName, fileName, 3600);
  }
}
