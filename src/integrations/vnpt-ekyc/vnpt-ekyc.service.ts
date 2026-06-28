import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import FormData from 'form-data';
import { lastValueFrom } from 'rxjs';
import {
  VNPT_EKYC_ENDPOINTS,
} from './vnpt-ekyc.constants';
import {
  VnptUploadFileResponse,
  VnptOcrResponse,
  VnptCardLivenessResponse,
  VnptFaceLivenessResponse,
  VnptFaceCompareResponse,
  VnptMaskFaceResponse,
} from './vnpt-ekyc.types';
import {
  mockUploadFileResponse,
  mockOcrResponse,
  mockCardLivenessResponse,
  mockFaceLivenessResponse,
  mockFaceCompareResponse,
  mockMaskFaceResponse,
} from './vnpt-ekyc.mock';
import { EkycProviderApiName } from '@prisma/client';

@Injectable()
export class VnptEkycService {
  private readonly logger = new Logger(VnptEkycService.name);
  
  private readonly baseUrl = process.env.VNPT_EKYC_BASE_URL || 'https://api.idg.vnpt.vn';
  private readonly accessToken = process.env.VNPT_EKYC_ACCESS_TOKEN || '';
  private readonly tokenId = process.env.VNPT_EKYC_TOKEN_ID || '';
  private readonly tokenKey = process.env.VNPT_EKYC_TOKEN_KEY || '';
  private readonly macAddress = process.env.VNPT_EKYC_MAC_ADDRESS_OR_TOKEN || 'TEST1';
  private readonly mode = process.env.VNPT_EKYC_MODE || 'mock';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  private get isMock() {
    return this.mode === 'mock';
  }

  private buildJsonHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Token-id': this.tokenId,
      'Token-key': this.tokenKey,
      'mac-address': this.macAddress,
      'Content-Type': 'application/json',
    };
  }

  private buildUploadHeaders(formDataHeaders: any) {
    return {
      ...formDataHeaders,
      Authorization: `Bearer ${this.accessToken}`,
      'Token-id': this.tokenId,
      'Token-key': this.tokenKey,
    };
  }

  private buildClientSession(sessionId: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    return `WEB_pockie_browser_Device_1.0_${sessionId}_${timestamp}`;
  }

  private async logRequest(
    sessionId: string | null,
    apiName: EkycProviderApiName,
    endpoint: string,
    httpMethod: string,
    requestPayload: any,
    responsePayload: any,
    statusCode: number,
    message: string,
    errorMessage: string | null,
    durationMs: number,
  ) {
    try {
      await this.prisma.ekycProviderRequest.create({
        data: {
          sessionId,
          provider: this.isMock ? 'VNPT_MOCK' : 'VNPT',
          apiName,
          endpoint,
          httpMethod,
          requestPayload: requestPayload || {}, // Redact sensitive images before passing here
          responsePayload: responsePayload || {},
          statusCode,
          message,
          errorMessage,
          durationMs,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log provider request: ${error.message}`, error.stack);
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    title: string,
    description: string = '',
    sessionId: string | null = null,
  ): Promise<VnptUploadFileResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.uploadFile;
    const url = `${this.baseUrl}${endpoint}`;

    if (this.isMock) {
      const mockRes = mockUploadFileResponse(fileName);
      await this.logRequest(sessionId, 'UPLOAD_FILE', endpoint, 'POST', { title, description }, mockRes, 200, mockRes.message, null, Date.now() - startTime);
      return mockRes;
    }

    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });
    form.append('title', title);
    form.append('description', description);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, form, { headers: this.buildUploadHeaders(form.getHeaders()) })
      );
      
      const responseData = response.data;
      const result: VnptUploadFileResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'UPLOAD_FILE', endpoint, 'POST', { title, description }, responseData, response.status, responseData.message || 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'UPLOAD_FILE', endpoint, 'POST', { title, description }, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }

  async ocrId(
    frontHash: string,
    backHash: string,
    sessionId: string,
  ): Promise<VnptOcrResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.ocr.web;
    const url = `${this.baseUrl}${endpoint}`;

    const payload = {
      img_front: frontHash,
      img_back: backHash,
      client_session: this.buildClientSession(sessionId),
      type: -1,
      validate_postcode: true,
      crop_param: false,
      token: this.macAddress,
    };

    const safePayload = { ...payload, img_front: '[HASH]', img_back: '[HASH]' };

    if (this.isMock) {
      const mockRes = mockOcrResponse();
      await this.logRequest(sessionId, 'OCR_ID', endpoint, 'POST', safePayload, mockRes, 200, mockRes.message, null, Date.now() - startTime);
      return mockRes;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers: this.buildJsonHeaders() })
      );
      
      const responseData = response.data;
      const result: VnptOcrResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'OCR_ID', endpoint, 'POST', safePayload, responseData, response.status, responseData.message || 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'OCR_ID', endpoint, 'POST', safePayload, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }

  async cardLiveness(
    frontHash: string,
    sessionId: string,
  ): Promise<VnptCardLivenessResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.cardLiveness.web;
    const url = `${this.baseUrl}${endpoint}`;

    const payload = {
      img: frontHash,
      client_session: this.buildClientSession(sessionId),
      crop_param: false,
      token: this.macAddress,
    };

    const safePayload = { ...payload, img: '[HASH]' };

    if (this.isMock) {
      const mockRes = mockCardLivenessResponse();
      await this.logRequest(sessionId, 'LIVENESS_CARD', endpoint, 'POST', safePayload, mockRes, 200, mockRes.liveness_msg, null, Date.now() - startTime);
      return mockRes;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers: this.buildJsonHeaders() })
      );
      
      const responseData = response.data;
      const result: VnptCardLivenessResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'LIVENESS_CARD', endpoint, 'POST', safePayload, responseData, response.status, responseData.liveness_msg || 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'LIVENESS_CARD', endpoint, 'POST', safePayload, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }

  async faceLiveness2D(
    selfieHash: string,
    sessionId: string,
  ): Promise<VnptFaceLivenessResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.faceLiveness2D;
    const url = `${this.baseUrl}${endpoint}`;

    const payload = {
      img: selfieHash,
      client_session: this.buildClientSession(sessionId),
      token: this.macAddress,
    };

    const safePayload = { ...payload, img: '[HASH]' };

    if (this.isMock) {
      const mockRes = mockFaceLivenessResponse();
      await this.logRequest(sessionId, 'FACE_LIVENESS_2D', endpoint, 'POST', safePayload, mockRes, 200, mockRes.liveness_msg, null, Date.now() - startTime);
      return mockRes;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers: this.buildJsonHeaders() })
      );
      
      const responseData = response.data;
      const result: VnptFaceLivenessResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'FACE_LIVENESS_2D', endpoint, 'POST', safePayload, responseData, response.status, responseData.liveness_msg || 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'FACE_LIVENESS_2D', endpoint, 'POST', safePayload, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }

  async faceCompare(
    frontHash: string,
    selfieHash: string,
    sessionId: string,
  ): Promise<VnptFaceCompareResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.faceCompare.web;
    const url = `${this.baseUrl}${endpoint}`;

    const payload = {
      img_front: frontHash,
      img_face: selfieHash,
      client_session: this.buildClientSession(sessionId),
      token: this.macAddress,
    };

    const safePayload = { ...payload, img_front: '[HASH]', img_face: '[HASH]' };

    if (this.isMock) {
      const mockRes = mockFaceCompareResponse();
      await this.logRequest(sessionId, 'FACE_COMPARE', endpoint, 'POST', safePayload, mockRes, 200, mockRes.msg, null, Date.now() - startTime);
      return mockRes;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers: this.buildJsonHeaders() })
      );
      
      const responseData = response.data;
      const result: VnptFaceCompareResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'FACE_COMPARE', endpoint, 'POST', safePayload, responseData, response.status, responseData.msg || 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'FACE_COMPARE', endpoint, 'POST', safePayload, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }

  async maskFace(
    selfieHash: string,
    sessionId: string,
  ): Promise<VnptMaskFaceResponse> {
    const startTime = Date.now();
    const endpoint = VNPT_EKYC_ENDPOINTS.maskFace.web;
    const url = `${this.baseUrl}${endpoint}`;

    const payload = {
      img: selfieHash,
      client_session: this.buildClientSession(sessionId),
      token: this.macAddress,
    };

    const safePayload = { ...payload, img: '[HASH]' };

    if (this.isMock) {
      const mockRes = mockMaskFaceResponse();
      await this.logRequest(sessionId, 'MASK_FACE', endpoint, 'POST', safePayload, mockRes, 200, mockRes.masked, null, Date.now() - startTime);
      return mockRes;
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers: this.buildJsonHeaders() })
      );
      
      const responseData = response.data;
      const result: VnptMaskFaceResponse = {
        ...responseData,
        raw_response_json: responseData,
      };

      await this.logRequest(sessionId, 'MASK_FACE', endpoint, 'POST', safePayload, responseData, response.status, 'success', null, Date.now() - startTime);
      
      return result;
    } catch (error) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {};
      const errMsg = error.message;
      await this.logRequest(sessionId, 'MASK_FACE', endpoint, 'POST', safePayload, data, status, data.message || 'error', errMsg, Date.now() - startTime);
      throw error;
    }
  }
}
