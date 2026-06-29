import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { lastValueFrom } from 'rxjs';
import { VnSocialProjectType } from '@prisma/client';
import { mockHotKeywordsByProject, mockHotPostsByProject, mockPostsByProject, mockProjects } from './vnsocial.mock';
import { VnSocialApiRequestOptions, VnSocialHotKeywordDto, VnSocialPostDto, VnSocialProjectDto } from './vnsocial.types';

@Injectable()
export class VnSocialService {
  private readonly logger = new Logger(VnSocialService.name);
  private readonly mode = process.env.VNSOCIAL_MODE || 'mock';
  private readonly baseUrl = process.env.VNSOCIAL_BASE_URL || 'https://api-vnsocialplus.vnpt.vn/social-api/v1';
  private accessToken = this.normalizeBearerToken(process.env.VNSOCIAL_ACCESS_TOKEN || process.env.VNSOCIAL_API_KEY || '');
  private readonly username = process.env.VNSOCIAL_USERNAME || '';
  private readonly password = process.env.VNSOCIAL_PASSWORD || '';
  private readonly loginEndpoint = process.env.VNSOCIAL_LOGIN_ENDPOINT || '/login';
  private readonly projectsEndpoint = process.env.VNSOCIAL_PROJECTS_ENDPOINT || '/projects';
  private readonly topicPostsEndpoint = process.env.VNSOCIAL_TOPIC_POSTS_ENDPOINT || '/projects/posts';
  private readonly sourcePostsEndpoint = process.env.VNSOCIAL_SOURCE_POSTS_ENDPOINT || '/source-follow/posts';
  private readonly hotKeywordsEndpoint = process.env.VNSOCIAL_HOT_KEYWORDS_ENDPOINT || '/projects/hot-keywords';
  private readonly hotPostsEndpoint = process.env.VNSOCIAL_HOT_POSTS_ENDPOINT || '/projects/hot-posts';
  private readonly authHeaderName = process.env.VNSOCIAL_AUTH_HEADER || 'Authorization';
  private refreshTokenPromise: Promise<void> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  private get isMock() {
    return this.mode === 'mock';
  }

  async getProjects() {
    if (this.isMock) return mockProjects;

    const response = await this.request({ method: 'GET', endpoint: this.projectsEndpoint });
    return this.extractArray(response).map((item) => this.mapProject(item));
  }

  async getProjectPosts(project: { id: string; externalProjectId: string | null; externalSourceId: string | null; type: VnSocialProjectType }) {
    if (this.isMock) return mockPostsByProject[project.externalProjectId || ''] || [];

    const isSourceProject = project.type === VnSocialProjectType.PERSONAL_POST;
    const endpoint = isSourceProject ? this.sourcePostsEndpoint : this.topicPostsEndpoint;
    const payload = isSourceProject
      ? { source_id: project.externalSourceId || project.externalProjectId }
      : { project_id: project.externalProjectId };

    const response = await this.request({ method: 'POST', endpoint, payload, projectId: project.id });
    return this.extractArray(response).map((item) => this.mapPost(item));
  }

  async getHotKeywords(project: { id: string; externalProjectId: string | null }) {
    if (this.isMock) return mockHotKeywordsByProject[project.externalProjectId || ''] || [];

    const response = await this.request({
      method: 'POST',
      endpoint: this.hotKeywordsEndpoint,
      payload: { project_id: project.externalProjectId },
      projectId: project.id,
    });
    return this.extractArray(response).map((item) => this.mapHotKeyword(item));
  }

  async getHotPosts(project: { id: string; externalProjectId: string | null }) {
    if (this.isMock) return mockHotPostsByProject[project.externalProjectId || ''] || [];

    const response = await this.request({
      method: 'POST',
      endpoint: this.hotPostsEndpoint,
      payload: { project_id: project.externalProjectId },
      projectId: project.id,
    });
    return this.extractArray(response).map((item) => this.mapPost(item));
  }

  private async request(options: VnSocialApiRequestOptions) {
    const startedAt = Date.now();
    const url = `${this.baseUrl}${options.endpoint}`;

    try {
      const response = await this.requestWithRetry(options, url);

      await this.prisma.vnSocialApiLog.create({
        data: {
          projectId: options.projectId || null,
          endpoint: options.endpoint,
          httpMethod: options.method,
          requestPayload: options.payload || options.params || {},
          responsePayload: response.data || {},
          statusCode: response.status,
          message: 'success',
          durationMs: Date.now() - startedAt,
        },
      });

      return response.data;
    } catch (error: any) {
      await this.prisma.vnSocialApiLog.create({
        data: {
          projectId: options.projectId || null,
          endpoint: options.endpoint,
          httpMethod: options.method,
          requestPayload: options.payload || options.params || {},
          responsePayload: error.response?.data || {},
          statusCode: error.response?.status || 500,
          message: error.response?.data?.message || 'error',
          errorMessage: error.message,
          durationMs: Date.now() - startedAt,
        },
      });
      this.logger.error(`VnSocial request failed at ${options.endpoint}: ${error.message}`);
      if (this.isAuthFailurePayload(error.response?.data)) {
        throw new BadGatewayException('VnSocial access token is invalid or expired');
      }
      throw error;
    }
  }

  private async buildHeaders() {
    if (this.isMock) return {};
    const token = await this.getAccessToken();
    const authValue = this.authHeaderName.toLowerCase() === 'authorization' ? `Bearer ${token}` : token;
    return {
      [this.authHeaderName]: authValue,
      'Content-Type': 'application/json',
    };
  }

  private async getAccessToken() {
    if (this.accessToken) return this.accessToken;
    await this.refreshAccessToken();
    if (this.accessToken) return this.accessToken;

    throw new Error('Missing VNSOCIAL_ACCESS_TOKEN');
  }

  private async requestWithRetry(options: VnSocialApiRequestOptions, url: string) {
    try {
      return await this.executeHttpRequest(options, url);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }

      this.logger.warn('Received 401 from VnSocial. Attempting token refresh...');

      if (!this.username || !this.password) {
        this.logger.error('Missing VNSOCIAL_USERNAME or VNSOCIAL_PASSWORD, cannot auto-refresh VnSocial token.');
        throw error;
      }

      if (!this.refreshTokenPromise) {
        this.refreshTokenPromise = this.refreshAccessToken().finally(() => {
          this.refreshTokenPromise = null;
        });
      }

      await this.refreshTokenPromise;
      this.logger.log('Retrying VnSocial request after token refresh...');
      return this.executeHttpRequest(options, url);
    }
  }

  private async executeHttpRequest(options: VnSocialApiRequestOptions, url: string) {
    const headers = await this.buildHeaders();
    const response = await lastValueFrom(
      options.method === 'GET'
        ? this.httpService.get(url, { headers, params: options.params })
        : this.httpService.post(url, options.payload || {}, { headers, params: options.params }),
    );
    if (this.isAuthFailurePayload(response.data)) {
      const error = new Error(response.data?.message || 'VnSocial authentication failed') as any;
      error.response = {
        status: 401,
        data: response.data,
      };
      throw error;
    }
    return response;
  }

  private isAuthFailurePayload(payload: any) {
    if (!payload || typeof payload !== 'object') return false;
    const message = String(payload.message || '').toLowerCase();
    return payload.expireToken === true || message.includes('no token') || message.includes('authenticate token');
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error('Cannot refresh VnSocial access token: missing VNSOCIAL_USERNAME or VNSOCIAL_PASSWORD');
    }

    const response = await lastValueFrom(
      this.httpService.post(`${this.baseUrl}${this.loginEndpoint}`, {
        username: this.username,
        password: this.password,
      }),
    );

    const token = this.extractAccessToken(response.data);

    if (!token || typeof token !== 'string') {
      throw new Error('Unable to extract VnSocial access token from login response');
    }

    this.accessToken = this.normalizeBearerToken(token);
    this.logger.log('Successfully refreshed VnSocial access token');
  }

  private extractAccessToken(payload: any): string | null {
    const token =
      payload?.object?.access_token ||
      payload?.object?.token ||
      payload?.object ||
      payload?.access_token ||
      payload?.token;

    return typeof token === 'string' ? token : null;
  }

  private normalizeBearerToken(token: string) {
    return token.replace(/^Bearer\s+/i, '').trim();
  }

  private extractArray(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.object)) return payload.object;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.object?.items)) return payload.object.items;
    if (Array.isArray(payload?.object?.data)) return payload.object.data;
    return [];
  }

  private mapProject(raw: any): VnSocialProjectDto {
    const typeValue = String(raw.type || raw.projectType || '').toUpperCase();
    const type =
      typeValue === VnSocialProjectType.TOPIC_POLICY ? VnSocialProjectType.TOPIC_POLICY :
      typeValue === VnSocialProjectType.PERSONAL_POST ? VnSocialProjectType.PERSONAL_POST :
      VnSocialProjectType.UNKNOWN;

    return {
      externalProjectId: String(raw.project_id || raw.id || raw.projectId || raw.source_id || raw.sourceId),
      externalSourceId: raw.source_id || raw.sourceId || null,
      name: raw.name || raw.title || 'Unnamed VnSocial project',
      type,
      status: raw.status || 'ACTIVE',
      sourceName: raw.sourceName || raw.source_name || null,
      rawJson: raw,
    };
  }

  private mapPost(raw: any): VnSocialPostDto {
    return {
      externalDocId: String(raw.doc_id || raw.id || raw.post_id || raw.postId),
      source: raw.source || raw.channel || null,
      sourceName: raw.sourceName || raw.source_name || null,
      userName: raw.userName || raw.user_name || null,
      postLink: raw.postLink || raw.link || null,
      domain: raw.domain || null,
      title: raw.title || null,
      description: raw.description || null,
      content: raw.content || null,
      tags: raw.tags || null,
      senti: raw.senti || raw.sentiment || null,
      isSpam: typeof raw.isSpam === 'boolean' ? raw.isSpam : typeof raw.is_spam === 'boolean' ? raw.is_spam : null,
      postType: raw.postType || raw.post_type || null,
      numInteractions: this.toNumber(raw.numInteractions || raw.num_interactions),
      numComments: this.toNumber(raw.numComments || raw.num_comments),
      numShares: this.toNumber(raw.numShares || raw.num_shares),
      createDate: this.toDate(raw.createDate || raw.create_date),
      updateDate: this.toDate(raw.updateDate || raw.update_date),
      rawJson: raw,
    };
  }

  private mapHotKeyword(raw: any): VnSocialHotKeywordDto {
    return {
      keyword: String(raw.keyword || raw.name || ''),
      docCount: this.toNumber(raw.docCount || raw.doc_count),
      sourceFilter: raw.sourceFilter || raw.source_filter || null,
      startTime: this.toDate(raw.startTime || raw.start_time),
      endTime: this.toDate(raw.endTime || raw.end_time),
      score: this.toNumber(raw.score),
      rawJson: raw,
    };
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toNumber(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
