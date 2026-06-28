import {
  VnptUploadFileResponse,
  VnptOcrResponse,
  VnptCardLivenessResponse,
  VnptFaceLivenessResponse,
  VnptFaceLiveness3DResponse,
  VnptFaceCompareResponse,
  VnptMaskFaceResponse,
} from './vnpt-ekyc.types';

export const mockUploadFileResponse = (fileName: string): VnptUploadFileResponse => ({
  message: 'Success',
  object: {
    fileName,
    title: 'Uploaded File',
    description: '',
    hash: `mock_hash_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    fileType: 'image/jpeg',
    uploadedDate: new Date().toISOString(),
    storageType: 'S3',
    tokenID: 'mock_token_id',
  },
  raw_response_json: { mock: true },
});

export const mockOcrResponse = (isValid = true): VnptOcrResponse => ({
  server_version: '1.0',
  message: 'Success',
  statusCode: 200,
  object: {
    msg: 'Thành công',
    type_id: 2,
    id: '001099001122',
    id_prob: 0.99,
    name: 'NGUYỄN VĂN A',
    name_prob: 0.98,
    birth_day: '01/01/1990',
    birth_day_prob: 0.99,
    gender: 'Nam',
    nationality: 'Việt Nam',
    issue_date: '01/01/2021',
    valid_date: '01/01/2040',
    warning: isValid ? [] : ['id_mo_nhoe'],
    warning_msg: isValid ? [] : ['ID mờ nhòe'],
  },
  raw_response_json: { mock: true },
});

export const mockCardLivenessResponse = (isReal = true): VnptCardLivenessResponse => ({
  liveness: isReal ? 'success' : 'failure',
  liveness_msg: isReal ? 'Giấy tờ thật' : 'Giấy tờ giả',
  face_swapping: false,
  fake_liveness: !isReal,
  fake_print_photo: false,
  raw_response_json: { mock: true },
});

export const mockFaceLivenessResponse = (isReal = true): VnptFaceLivenessResponse => ({
  blur_face: 'no',
  blur_face_score: 0.1,
  liveness: isReal ? 'success' : 'failure',
  liveness_msg: isReal ? 'Người thật' : 'Người giả',
  is_eye_open: 'yes',
  liveness_prob: isReal ? 0.1 : 0.9,
  age: 30,
  raw_response_json: { mock: true },
});

export const mockFaceCompareResponse = (isMatch = true): VnptFaceCompareResponse => ({
  result: isMatch ? 'MATCH' : 'NOMATCH',
  msg: isMatch ? 'MATCH' : 'NOMATCH',
  prob: isMatch ? 0.99 : 0.1,
  multiple_faces: false,
  raw_response_json: { mock: true },
});

export const mockMaskFaceResponse = (isMasked = false): VnptMaskFaceResponse => ({
  masked: isMasked ? 'yes' : 'no',
  raw_response_json: { mock: true },
});
