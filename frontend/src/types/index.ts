// 后端返回的统一响应格式
export interface BaseResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface UserVO {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
  role?: string;
}

export interface LoginVO {
  accessToken: string;
  refreshToken: string;
  userInfo: UserVO;
}

export interface QuestionVO {
  id: number;
  title: string;
  content?: string;
  answer?: string;
  tags?: string[];
  type?: string;
  difficulty?: string;
  template?: string;
  timeLimit?: number;
  memoryLimit?: number;
  acceptedCount?: number;
  submissionCount?: number;
  acceptanceRate?: number;
  userId?: number;
  createTime?: string;
  updateTime?: string;
}

export interface TestCase {
  id: number;
  questionId: number;
  input: string;
  output: string;
  isExample: number;
  score: number;
}

export interface Page<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface QuestionQueryDTO {
  title?: string;
  tags?: string[];
  type?: string;
  difficulty?: string;
  current: number;
  pageSize: number;
}

export interface SubmissionVO {
  id: number;
  questionId: number;
  userId: number;
  languageCode: string;
  code: string;
  status: string;
  executionTime?: number;
  executionMemory?: number;
  totalTestCase?: number;
  passedTestCase?: number;
  errorMessage?: string;
  createTime?: string;
  updateTime?: string;
}

export interface QuestionSubmitDTO {
  questionId: number;
  languageCode: string;
  code: string;
}

// ========== RAG ==========
export interface SourceQuestion {
  questionId: number;
  title: string;
}

export interface RagChatResponse {
  answer: string;
  sourceQuestions: SourceQuestion[];
  cacheHit: boolean;
}
