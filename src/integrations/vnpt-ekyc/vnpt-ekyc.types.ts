export interface VnptUploadFileResponse {
  message: string;
  object: {
    fileName: string;
    title: string;
    description: string;
    hash: string;
    fileType: string;
    uploadedDate: string;
    storageType: string;
    tokenID: string;
  };
  raw_response_json: any;
}

export interface VnptOcrResponse {
  server_version: string;
  message: string;
  errors?: string;
  statusCode: number;
  object: {
    msg?: string;
    msg_back?: string;
    type_id?: number;
    back_type_id?: number;
    card_type?: string;
    id?: string;
    id_prob?: number;
    id_probs?: number[];
    post_code?: string;
    name?: string;
    name_prob?: number;
    name_probs?: number[];
    birth_day?: string;
    birth_day_prob?: number;
    nationality?: string;
    ethnicity?: string;
    ethnicity_prob?: number;
    religion?: string;
    religion_prob?: number;
    gender?: string;
    valid_date?: string;
    origin_location?: string;
    origin_location_prob?: number;
    recent_location?: string;
    recent_location_prob?: number;
    issue_date?: string;
    issue_date_prob?: number;
    issue_date_probs?: number[];
    issue_place?: string;
    issue_place_prob?: number;
    match_front_back?: string;
    match_info_passport_vn?: string;
    warning?: string[];
    warning_msg?: string[];
    tampering?: any;
    expire_warning?: string;
    back_expire_warning?: string;
    id_fake_warning?: string;
    corner_warning?: string;
    back_corner_warning?: string;
    name_fake_warning?: string;
    check_photocopied_result?: string;
    quality_front?: string;
    quality_back?: string;
  };
  dataSign?: string;
  database64?: string;
  raw_response_json: any;
}

export interface VnptCardLivenessResponse {
  liveness: string;
  liveness_msg: string;
  face_swapping: boolean;
  fake_liveness: boolean;
  face_swapping_prob?: number;
  fake_liveness_prob?: number;
  fake_print_photo: boolean;
  fake_print_photo_prob?: number;
  raw_response_json: any;
}

export interface VnptFaceLivenessResponse {
  blur_face: string;
  blur_face_score: number;
  liveness: string;
  liveness_msg: string;
  is_eye_open: string;
  liveness_prob: number;
  age: number;
  background_warning?: string;
  multiple_faces_details?: any;
  multiple_face_1?: boolean;
  raw_response_json: any;
}

export interface VnptFaceLiveness3DResponse extends VnptFaceLivenessResponse {
  gender?: string;
  multiple_face_2?: boolean;
}

export interface VnptFaceCompareResponse {
  result: string;
  msg: string;
  prob: number;
  multiple_faces: boolean;
  match_warning?: string;
  multiple_faces_details?: any;
  multiple_face_1?: boolean;
  multiple_face_2?: boolean;
  raw_response_json: any;
}

export interface VnptFaceCompareGeneralResponse {
  msg: string;
  prob: number;
  raw_response_json: any;
}

export interface VnptMaskFaceResponse {
  masked: string;
  raw_response_json: any;
}
