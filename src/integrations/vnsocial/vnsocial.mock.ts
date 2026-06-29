import { VnSocialProjectType } from '@prisma/client';
import { VnSocialHotKeywordDto, VnSocialPostDto, VnSocialProjectDto } from './vnsocial.types';

const now = Date.now();

export const mockProjects: VnSocialProjectDto[] = [
  {
    externalProjectId: 'topic-genz-finance',
    name: 'Gen Z Finance',
    type: VnSocialProjectType.TOPIC_POLICY,
    status: 'ACTIVE',
    sourceName: 'facebook,tiktok,forum',
    rawJson: { id: 'topic-genz-finance', name: 'Gen Z Finance', type: 'TOPIC_POLICY' },
  },
  {
    externalProjectId: 'topic-travel-cashback',
    name: 'Travel Cashback',
    type: VnSocialProjectType.TOPIC_POLICY,
    status: 'ACTIVE',
    sourceName: 'facebook,tiktok,youtube',
    rawJson: { id: 'topic-travel-cashback', name: 'Travel Cashback', type: 'TOPIC_POLICY' },
  },
  {
    externalProjectId: 'source-techcombank',
    externalSourceId: 'source-techcombank-page',
    name: 'Techcombank Social Feed',
    type: VnSocialProjectType.PERSONAL_POST,
    status: 'ACTIVE',
    sourceName: 'facebook',
    rawJson: { id: 'source-techcombank', source_id: 'source-techcombank-page', name: 'Techcombank Social Feed', type: 'PERSONAL_POST' },
  },
];

export const mockPostsByProject: Record<string, VnSocialPostDto[]> = {
  'topic-genz-finance': [
    {
      externalDocId: 'genz-001',
      source: 'tiktok',
      sourceName: 'TikTok',
      userName: 'daily.money.hacks',
      postLink: 'https://example.com/genz-001',
      domain: 'tiktok.com',
      title: 'Gen Z đang siết lại chi tiêu cuối tháng',
      description: 'Các bạn trẻ bàn mạnh về budgeting, chi tiêu tuần và săn hoàn tiền.',
      content: 'Budgeting, ví điện tử, hoàn tiền và kiểm soát chi tiêu là các chủ đề tăng mạnh.',
      senti: 'positive',
      isSpam: false,
      postType: 'video',
      numInteractions: 5230,
      numComments: 684,
      numShares: 312,
      createDate: new Date(now - 2 * 60 * 60 * 1000),
      updateDate: new Date(now - 90 * 60 * 1000),
      rawJson: { id: 'genz-001' },
    },
  ],
  'topic-travel-cashback': [
    {
      externalDocId: 'travel-001',
      source: 'facebook',
      sourceName: 'Facebook',
      userName: 'travel.weekend.vn',
      postLink: 'https://example.com/travel-001',
      domain: 'facebook.com',
      title: 'Hoàn tiền du lịch cuối tuần lên ngôi',
      description: 'Các bài viết về hoàn tiền du lịch, vé máy bay và khách sạn tăng đều.',
      content: 'Người dùng quan tâm thẻ tín dụng hoàn tiền, trả góp du lịch và voucher khách sạn.',
      senti: 'positive',
      isSpam: false,
      postType: 'post',
      numInteractions: 8140,
      numComments: 902,
      numShares: 456,
      createDate: new Date(now - 4 * 60 * 60 * 1000),
      updateDate: new Date(now - 2 * 60 * 60 * 1000),
      rawJson: { id: 'travel-001' },
    },
  ],
  'source-techcombank': [
    {
      externalDocId: 'tcb-001',
      source: 'facebook',
      sourceName: 'Facebook',
      userName: 'Techcombank',
      postLink: 'https://example.com/tcb-001',
      domain: 'facebook.com',
      title: 'Ngân hàng số thúc đẩy thanh toán không tiền mặt',
      description: 'Bài post từ nguồn theo dõi về xu hướng chuyển đổi số.',
      content: 'Thanh toán số, cá nhân hoá ưu đãi và cashback là trọng tâm tương tác.',
      senti: 'neutral',
      isSpam: false,
      postType: 'post',
      numInteractions: 1680,
      numComments: 124,
      numShares: 78,
      createDate: new Date(now - 8 * 60 * 60 * 1000),
      updateDate: new Date(now - 6 * 60 * 60 * 1000),
      rawJson: { id: 'tcb-001' },
    },
  ],
};

export const mockHotKeywordsByProject: Record<string, VnSocialHotKeywordDto[]> = {
  'topic-genz-finance': [
    {
      keyword: 'budget tuần',
      docCount: 87,
      sourceFilter: 'tiktok,facebook',
      startTime: new Date(now - 24 * 60 * 60 * 1000),
      endTime: new Date(now),
      score: 84,
      rawJson: { keyword: 'budget tuần', docCount: 87 },
    },
    {
      keyword: 'hoàn tiền ăn uống',
      docCount: 63,
      sourceFilter: 'facebook,forum',
      startTime: new Date(now - 24 * 60 * 60 * 1000),
      endTime: new Date(now),
      score: 76,
      rawJson: { keyword: 'hoàn tiền ăn uống', docCount: 63 },
    },
  ],
  'topic-travel-cashback': [
    {
      keyword: 'cashback du lịch',
      docCount: 112,
      sourceFilter: 'facebook,tiktok',
      startTime: new Date(now - 24 * 60 * 60 * 1000),
      endTime: new Date(now),
      score: 91,
      rawJson: { keyword: 'cashback du lịch', docCount: 112 },
    },
  ],
  'source-techcombank': [
    {
      keyword: 'thanh toán số',
      docCount: 29,
      sourceFilter: 'facebook',
      startTime: new Date(now - 24 * 60 * 60 * 1000),
      endTime: new Date(now),
      score: 58,
      rawJson: { keyword: 'thanh toán số', docCount: 29 },
    },
  ],
};

export const mockHotPostsByProject: Record<string, VnSocialPostDto[]> = {
  'topic-genz-finance': mockPostsByProject['topic-genz-finance'],
  'topic-travel-cashback': mockPostsByProject['topic-travel-cashback'],
  'source-techcombank': mockPostsByProject['source-techcombank'],
};
