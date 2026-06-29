import { VnSocialProjectType } from '@prisma/client';

export interface VnSocialProjectDto {
  externalProjectId: string;
  externalSourceId?: string | null;
  name: string;
  type: VnSocialProjectType;
  status?: string | null;
  sourceName?: string | null;
  rawJson: any;
}

export interface VnSocialPostDto {
  externalDocId: string;
  source?: string | null;
  sourceName?: string | null;
  userName?: string | null;
  postLink?: string | null;
  domain?: string | null;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  tags?: any;
  senti?: string | null;
  isSpam?: boolean | null;
  postType?: string | null;
  numInteractions?: number | null;
  numComments?: number | null;
  numShares?: number | null;
  createDate?: Date | null;
  updateDate?: Date | null;
  rawJson: any;
}

export interface VnSocialHotKeywordDto {
  keyword: string;
  docCount?: number | null;
  sourceFilter?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  score?: number | null;
  rawJson: any;
}

export interface VnSocialApiRequestOptions {
  method: 'GET' | 'POST';
  endpoint: string;
  params?: Record<string, any>;
  payload?: any;
  projectId?: string | null;
}
