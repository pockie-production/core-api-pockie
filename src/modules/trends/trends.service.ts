import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrendStatus, VnSocialSyncJobStatus, VnSocialSyncJobType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VnSocialService } from '../../integrations/vnsocial/vnsocial.service';
import { TrendDecisionDto, TrendsQueryDto } from './dto/trends.dto';

@Injectable()
export class TrendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vnSocialService: VnSocialService,
  ) {}

  async listProjects() {
    const projects = await this.prisma.vnSocialProject.findMany({
      include: {
        _count: {
          select: { posts: true, hotKeywords: true, hotPosts: true, trends: true },
        },
        syncJobs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: projects.map((project) => ({
        id: project.id,
        externalProjectId: project.externalProjectId,
        externalSourceId: project.externalSourceId,
        name: project.name,
        type: project.type,
        status: project.status,
        sourceName: project.sourceName,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        stats: {
          posts: project._count.posts,
          hotKeywords: project._count.hotKeywords,
          hotPosts: project._count.hotPosts,
          trends: project._count.trends,
        },
        lastSyncJobs: project.syncJobs.map((job) => ({
          id: job.id,
          jobType: job.jobType,
          status: job.status,
          pulledCount: job.pulledCount,
          createdAt: job.createdAt,
          finishedAt: job.finishedAt,
          errorMessage: job.errorMessage,
        })),
      })),
    };
  }

  async listSyncJobs() {
    const jobs = await this.prisma.vnSocialSyncJob.findMany({
      include: { project: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      items: jobs.map((job) => ({
        id: job.id,
        projectId: job.projectId,
        projectName: job.project?.name || null,
        jobType: job.jobType,
        status: job.status,
        pulledCount: job.pulledCount,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      })),
    };
  }

  async syncProjects(actorUserId: string) {
    const job = await this.createSyncJob(VnSocialSyncJobType.PROJECTS, null);
    try {
      const projects = await this.vnSocialService.getProjects();
      let count = 0;

      for (const item of projects) {
        const existing = await this.prisma.vnSocialProject.findFirst({
          where: { externalProjectId: item.externalProjectId },
        });

        if (existing) {
          await this.prisma.vnSocialProject.update({
            where: { id: existing.id },
            data: {
              externalSourceId: item.externalSourceId || null,
              name: item.name,
              type: item.type,
              status: item.status || 'ACTIVE',
              sourceName: item.sourceName || null,
              rawJson: item.rawJson,
            },
          });
        } else {
          await this.prisma.vnSocialProject.create({
            data: {
              externalProjectId: item.externalProjectId,
              externalSourceId: item.externalSourceId || null,
              name: item.name,
              type: item.type,
              status: item.status || 'ACTIVE',
              sourceName: item.sourceName || null,
              rawJson: item.rawJson,
            },
          });
        }

        count += 1;
      }

      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.SUCCESS, count, null);
      await this.logAdminAction(actorUserId, 'VNSOCIAL_SYNC_PROJECTS', null, { count });
      return { success: true, syncedCount: count };
    } catch (error: any) {
      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  async syncProjectPosts(projectId: string, actorUserId: string) {
    const project = await this.getProject(projectId);
    const job = await this.createSyncJob(VnSocialSyncJobType.POSTS, project.id);
    try {
      const posts = await this.vnSocialService.getProjectPosts(project);

      for (const post of posts) {
        await this.prisma.vnSocialPost.upsert({
          where: { externalDocId: post.externalDocId },
          create: {
            externalDocId: post.externalDocId,
            projectId: project.id,
            source: post.source || null,
            sourceName: post.sourceName || null,
            userName: post.userName || null,
            postLink: post.postLink || null,
            domain: post.domain || null,
            title: post.title || null,
            description: post.description || null,
            content: post.content || null,
            tags: post.tags || null,
            senti: post.senti || null,
            isSpam: post.isSpam ?? null,
            postType: post.postType || null,
            numInteractions: post.numInteractions ?? null,
            numComments: post.numComments ?? null,
            numShares: post.numShares ?? null,
            createDate: post.createDate || null,
            updateDate: post.updateDate || null,
            rawJson: post.rawJson,
          },
          update: {
            projectId: project.id,
            source: post.source || null,
            sourceName: post.sourceName || null,
            userName: post.userName || null,
            postLink: post.postLink || null,
            domain: post.domain || null,
            title: post.title || null,
            description: post.description || null,
            content: post.content || null,
            tags: post.tags || null,
            senti: post.senti || null,
            isSpam: post.isSpam ?? null,
            postType: post.postType || null,
            numInteractions: post.numInteractions ?? null,
            numComments: post.numComments ?? null,
            numShares: post.numShares ?? null,
            createDate: post.createDate || null,
            updateDate: post.updateDate || null,
            rawJson: post.rawJson,
          },
        });
      }

      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.SUCCESS, posts.length, null);
      await this.logAdminAction(actorUserId, 'VNSOCIAL_SYNC_POSTS', project.id, { count: posts.length });
      return { success: true, syncedCount: posts.length };
    } catch (error: any) {
      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  async syncProjectHotKeywords(projectId: string, actorUserId: string) {
    const project = await this.getProject(projectId);
    const job = await this.createSyncJob(VnSocialSyncJobType.HOT_KEYWORDS, project.id);
    try {
      const keywords = await this.vnSocialService.getHotKeywords(project);

      for (const keyword of keywords) {
        await this.prisma.vnSocialHotKeyword.upsert({
          where: {
            projectId_keyword: { projectId: project.id, keyword: keyword.keyword },
          },
          create: {
            projectId: project.id,
            keyword: keyword.keyword,
            docCount: keyword.docCount ?? null,
            sourceFilter: keyword.sourceFilter || null,
            startTime: keyword.startTime || null,
            endTime: keyword.endTime || null,
            score: keyword.score ?? null,
            rawJson: keyword.rawJson,
          },
          update: {
            docCount: keyword.docCount ?? null,
            sourceFilter: keyword.sourceFilter || null,
            startTime: keyword.startTime || null,
            endTime: keyword.endTime || null,
            score: keyword.score ?? null,
            rawJson: keyword.rawJson,
          },
        });

        await this.upsertTrend({
          externalId: `keyword:${project.externalProjectId || project.id}:${keyword.keyword}`,
          projectId: project.id,
          title: keyword.keyword,
          summary: `${keyword.docCount || 0} mentions in monitored period`,
          category: project.name,
          sentiment: null,
          score: keyword.score ?? this.normalizeKeywordScore(keyword.docCount || 0),
          origin: 'VNSOCIAL_HOT_KEYWORD',
          originRefId: keyword.keyword,
          sourceChannel: keyword.sourceFilter || project.sourceName || null,
          rawJson: keyword.rawJson,
        });
      }

      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.SUCCESS, keywords.length, null);
      await this.logAdminAction(actorUserId, 'VNSOCIAL_SYNC_HOT_KEYWORDS', project.id, { count: keywords.length });
      return { success: true, syncedCount: keywords.length };
    } catch (error: any) {
      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  async syncProjectHotPosts(projectId: string, actorUserId: string) {
    const project = await this.getProject(projectId);
    const job = await this.createSyncJob(VnSocialSyncJobType.HOT_POSTS, project.id);
    try {
      const posts = await this.vnSocialService.getHotPosts(project);

      for (const post of posts) {
        const hotPost = await this.prisma.vnSocialHotPost.upsert({
          where: { externalDocId: post.externalDocId },
          create: {
            externalDocId: post.externalDocId,
            projectId: project.id,
            source: post.source || null,
            sourceName: post.sourceName || null,
            domain: post.domain || null,
            postLink: post.postLink || null,
            title: post.title || null,
            description: post.description || null,
            content: post.content || null,
            senti: post.senti || null,
            numInteractions: post.numInteractions ?? null,
            numComments: post.numComments ?? null,
            numShares: post.numShares ?? null,
            createDate: post.createDate || null,
            updateDate: post.updateDate || null,
            rawJson: post.rawJson,
          },
          update: {
            projectId: project.id,
            source: post.source || null,
            sourceName: post.sourceName || null,
            domain: post.domain || null,
            postLink: post.postLink || null,
            title: post.title || null,
            description: post.description || null,
            content: post.content || null,
            senti: post.senti || null,
            numInteractions: post.numInteractions ?? null,
            numComments: post.numComments ?? null,
            numShares: post.numShares ?? null,
            createDate: post.createDate || null,
            updateDate: post.updateDate || null,
            rawJson: post.rawJson,
          },
        });

        await this.upsertTrend({
          externalId: `hotpost:${post.externalDocId}`,
          projectId: project.id,
          title: post.title || 'Untitled hot post',
          summary: post.description || post.content || 'Hot post synced from VnSocial',
          category: project.name,
          sentiment: post.senti || null,
          score: this.normalizeHotPostScore(post.numInteractions || 0, post.numComments || 0, post.numShares || 0),
          origin: 'VNSOCIAL_HOT_POST',
          originRefId: hotPost.id,
          sourceChannel: post.source || post.sourceName || null,
          rawJson: post.rawJson,
        });
      }

      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.SUCCESS, posts.length, null);
      await this.logAdminAction(actorUserId, 'VNSOCIAL_SYNC_HOT_POSTS', project.id, { count: posts.length });
      return { success: true, syncedCount: posts.length };
    } catch (error: any) {
      await this.finishSyncJob(job.id, VnSocialSyncJobStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  async listTrends(query: TrendsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where = this.buildTrendWhere(query);

    const [items, totalItems, summary] = await Promise.all([
      this.prisma.trend.findMany({
        where,
        include: { project: true },
        orderBy: [{ status: 'asc' }, { score: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.trend.count({ where }),
      this.getTrendSummaryCounts(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        category: item.category,
        sentiment: item.sentiment,
        score: item.score,
        status: item.status,
        source: item.source,
        sourceChannel: item.sourceChannel,
        project: item.project ? { id: item.project.id, name: item.project.name, type: item.project.type } : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      summary,
    };
  }

  async getTrendDetail(id: string) {
    const trend = await this.prisma.trend.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!trend) throw new NotFoundException('Trend not found');

    return {
      id: trend.id,
      title: trend.title,
      summary: trend.summary,
      category: trend.category,
      sentiment: trend.sentiment,
      score: trend.score,
      status: trend.status,
      source: trend.source,
      sourceChannel: trend.sourceChannel,
      origin: trend.origin,
      originRefId: trend.originRefId,
      reviewNote: trend.reviewNote,
      deployedAt: trend.deployedAt,
      project: trend.project ? { id: trend.project.id, name: trend.project.name, type: trend.project.type } : null,
      rawJson: trend.rawJson,
      createdAt: trend.createdAt,
      updatedAt: trend.updatedAt,
    };
  }

  async approveTrend(id: string, actorUserId: string, dto: TrendDecisionDto) {
    return this.updateTrendStatus(id, TrendStatus.APPROVED, actorUserId, dto.note || dto.reason || null, 'TREND_APPROVED');
  }

  async rejectTrend(id: string, actorUserId: string, dto: TrendDecisionDto) {
    return this.updateTrendStatus(id, TrendStatus.REJECTED, actorUserId, dto.reason || dto.note || null, 'TREND_REJECTED');
  }

  async deployTrend(id: string, actorUserId: string, dto: TrendDecisionDto) {
    return this.updateTrendStatus(id, TrendStatus.DEPLOYED, actorUserId, dto.note || dto.reason || null, 'TREND_DEPLOYED', true);
  }

  async archiveTrend(id: string, actorUserId: string, dto: TrendDecisionDto) {
    return this.updateTrendStatus(id, TrendStatus.ARCHIVED, actorUserId, dto.note || dto.reason || null, 'TREND_ARCHIVED');
  }

  private async getProject(id: string) {
    const project = await this.prisma.vnSocialProject.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('VnSocial project not found');
    return project;
  }

  private async createSyncJob(jobType: VnSocialSyncJobType, projectId: string | null) {
    return this.prisma.vnSocialSyncJob.create({
      data: {
        projectId,
        jobType,
        status: VnSocialSyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });
  }

  private async finishSyncJob(jobId: string, status: VnSocialSyncJobStatus, pulledCount: number, errorMessage: string | null) {
    await this.prisma.vnSocialSyncJob.update({
      where: { id: jobId },
      data: {
        status,
        pulledCount,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  private async upsertTrend(input: {
    externalId: string;
    projectId: string;
    title: string;
    summary: string | null;
    category: string | null;
    sentiment: string | null;
    score: number | null;
    origin: string;
    originRefId: string | null;
    sourceChannel: string | null;
    rawJson: any;
  }) {
    const existing = await this.prisma.trend.findFirst({
      where: { source: 'VNSOCIAL', externalId: input.externalId },
    });

    if (existing) {
      await this.prisma.trend.update({
        where: { id: existing.id },
        data: {
          projectId: input.projectId,
          title: input.title,
          summary: input.summary,
          category: input.category,
          sentiment: input.sentiment,
          score: input.score,
          origin: input.origin,
          originRefId: input.originRefId,
          sourceChannel: input.sourceChannel,
          rawJson: input.rawJson,
        },
      });
      return existing.id;
    }

    const created = await this.prisma.trend.create({
      data: {
        source: 'VNSOCIAL',
        externalId: input.externalId,
        title: input.title,
        summary: input.summary,
        category: input.category,
        sentiment: input.sentiment,
        score: input.score,
        status: TrendStatus.PENDING_REVIEW,
        origin: input.origin,
        originRefId: input.originRefId,
        sourceChannel: input.sourceChannel,
        projectId: input.projectId,
        rawJson: input.rawJson,
      },
    });

    return created.id;
  }

  private buildTrendWhere(query: TrendsQueryDto): Prisma.TrendWhereInput {
    const clauses: Prisma.TrendWhereInput[] = [];
    if (query.q?.trim()) {
      const q = query.q.trim();
      clauses.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) clauses.push({ status: query.status });
    if (query.sentiment) clauses.push({ sentiment: { equals: query.sentiment, mode: 'insensitive' } });
    if (query.sourceChannel) clauses.push({ sourceChannel: { contains: query.sourceChannel, mode: 'insensitive' } });
    if (query.projectId) clauses.push({ projectId: query.projectId });
    return clauses.length ? { AND: clauses } : {};
  }

  private async getTrendSummaryCounts() {
    const [total, pending, approved, deployed, rejected, archived] = await Promise.all([
      this.prisma.trend.count(),
      this.prisma.trend.count({ where: { status: TrendStatus.PENDING_REVIEW } }),
      this.prisma.trend.count({ where: { status: TrendStatus.APPROVED } }),
      this.prisma.trend.count({ where: { status: TrendStatus.DEPLOYED } }),
      this.prisma.trend.count({ where: { status: TrendStatus.REJECTED } }),
      this.prisma.trend.count({ where: { status: TrendStatus.ARCHIVED } }),
    ]);
    return { total, pending, approved, deployed, rejected, archived };
  }

  private normalizeKeywordScore(docCount: number) {
    return Math.min(100, Math.round(docCount * 1.5));
  }

  private normalizeHotPostScore(interactions: number, comments: number, shares: number) {
    const raw = interactions * 0.3 + comments * 0.4 + shares * 0.3;
    return Math.min(100, Math.round(Math.log10(raw + 10) * 35));
  }

  private async updateTrendStatus(
    id: string,
    status: TrendStatus,
    actorUserId: string,
    note: string | null,
    action: string,
    deployed = false,
  ) {
    const trend = await this.prisma.trend.findUnique({ where: { id } });
    if (!trend) throw new NotFoundException('Trend not found');

    const updated = await this.prisma.trend.update({
      where: { id },
      data: {
        status,
        reviewNote: note,
        ...(deployed ? { deployedAt: new Date() } : {}),
      },
    });

    await this.logAdminAction(actorUserId, action, id, {
      previousStatus: trend.status,
      nextStatus: status,
      note,
    });

    return {
      success: true,
      trend: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        reviewNote: updated.reviewNote,
        deployedAt: updated.deployedAt,
      },
    };
  }

  private async logAdminAction(actorUserId: string, action: string, targetId: string | null, payload: any) {
    await this.prisma.adminActionLog.create({
      data: {
        actorUserId,
        action,
        targetType: targetId ? 'TREND' : 'VNSOCIAL',
        targetId,
        payload,
      },
    });
  }
}
