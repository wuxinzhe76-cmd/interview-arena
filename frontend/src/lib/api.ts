import request from './request';
import type {
  BaseResponse,
  LoginVO,
  UserVO,
  QuestionVO,
  Page,
  QuestionQueryDTO,
  SubmissionVO,
  QuestionSubmitDTO,
} from '@/types';

// ========== 用户 ==========
export const userApi = {
  register: (data: { username: string; password: string }) =>
    request.post<any, BaseResponse<UserVO>>('/api/user/register', data),
  login: (data: { username: string; password: string }) =>
    request.post<any, BaseResponse<LoginVO>>('/api/user/login', data),
  logout: () => request.post<any, BaseResponse<void>>('/api/user/logout'),
  me: () => request.get<any, BaseResponse<UserVO>>('/api/user/me'),
};

// ========== 题目 ==========
export const questionApi = {
  list: (data: QuestionQueryDTO) =>
    request.post<any, BaseResponse<Page<QuestionVO>>>('/api/question/list/page/vo', data),
  get: (id: number) =>
    request.get<any, BaseResponse<QuestionVO>>(`/api/question/get/vo/${id}`),
};

// ========== 判题 ==========
export const judgeApi = {
  submit: (data: QuestionSubmitDTO) =>
    request.post<any, BaseResponse<number>>('/api/judge/submit', data),
  status: (submissionId: number) =>
    request.get<any, BaseResponse<SubmissionVO>>(`/api/judge/status/${submissionId}`),
  result: (submissionId: number) =>
    request.get<any, BaseResponse<any>>(`/api/judge/result/${submissionId}`),
  // 本地测试用:同步判题
  testSync: (submissionId: number) =>
    request.post<any, BaseResponse<string>>(`/api/judge/test-sync/${submissionId}`),
};
