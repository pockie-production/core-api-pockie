export const VNPT_EKYC_ENDPOINTS = {
  uploadFile: '/file-service/v1/addFile',

  ocr: {
    app: '/ai/v1/ocr/id',
    web: '/ai/v1/web/ocr/id',
  },

  cardLiveness: {
    app: '/ai/v1/card/liveness',
    web: '/ai/v1/web/card/liveness',
  },

  faceLiveness2D: '/ai/v1/face/liveness',

  faceLiveness3D: {
    app: '/ai/v1/face/liveness-3d',
    web: '/ai/v1/web/face/liveness-3d',
  },

  faceCompare: {
    app: '/ai/v1/face/compare',
    web: '/ai/v1/web/face/compare',
  },

  faceCompareGeneral: '/v1/face/compare-general',

  maskFace: {
    app: '/ai/v1/face/mask',
    web: '/ai/v1/web/face/mask',
  },
} as const;

export const VNPT_EKYC_HASH_TTL_DAYS = 7;

export const VNPT_OCR_DOCUMENT_TYPES = {
  AUTO: -1,
  CMND_9: 0,
  CMND_CCCD: 2,
  PASSPORT: 5,
  DRIVER_LICENSE: 6,
  MILITARY_ID: 7,
  CCCD_CHIP: 9,
  OTHER: 4,
} as const;

export const VNPT_COMPARE_GENERAL_THRESHOLD_LEVELS = {
  EASY: 'easy',
  NORMAL: 'normal',
  STRICT: 'strict',
} as const;
