import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async listCampaigns(params: { skip?: number; take?: number; search?: string; status?: string; organizationId?: string }) {
    const { skip = 0, take = 20, search, status, organizationId } = params;
    const where: Prisma.CampaignWhereInput = {};
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.approvalStatus = status as any;
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [total, items] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, items };
  }

  async createCampaign(data: Prisma.CampaignUncheckedCreateInput, creatorId: string) {
    return this.prisma.campaign.create({
      data: {
        ...data,
        approvalStatus: 'PENDING',
      },
    });
  }

  async updateCampaign(id: string, data: Prisma.CampaignUpdateInput, updaterId: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        approvalStatus: 'PENDING',
      },
    });
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async getActiveCampaigns(skip: number = 0, take: number = 20) {
    const where: Prisma.CampaignWhereInput = {
      approvalStatus: 'APPROVED',
      startsAt: { lte: new Date() },
      endsAt: { gte: new Date() },
    };

    const [total, items] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        skip,
        take,
        orderBy: { endsAt: 'asc' },
      }),
    ]);
    return { total, items };
  }

  async approveCampaign(id: string, checkerId: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: checkerId,
      },
    });
  }

  async rejectCampaign(id: string, checkerId: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: checkerId,
      },
    });
  }
}
