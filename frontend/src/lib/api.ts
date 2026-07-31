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
  RagChatResponse,
  SourceQuestion,
  InterviewStartDTO,
  InterviewAnswerDTO,
  InterviewStartVO,
  InterviewAnswerVO,
  QuickAskDTO,
  QuickAskResponse,
  SaveToKbDTO,
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

// ========== RAG ==========
export const ragApi = {
  chat: (message: string) =>
    request.post<any, BaseResponse<RagChatResponse>>('/api/rag/chat', { message }),

  /**
   * 流式 RAG 问答（SSE）：检索同步执行，LLM 生成流式输出 token
   * @returns { abort } 支持中途取消
   */
  chatStream: (
    message: string,
    callbacks: {
      onMeta?: (meta: { cacheHit: boolean; sourceQuestions: SourceQuestion[] }) => void;
      onToken: (token: string) => void;
      onDone?: () => void;
      onError?: (err: string) => void;
    }
  ): { abort: () => void } => {
    const controller = new AbortController();

    const run = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
        const response = await fetch('/api/rag/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: token } : {}),
          },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';
        let dataLines: string[] = [];
        let finished = false;

        const flushEvent = () => {
          if (!currentEvent || dataLines.length === 0) return;
          // data: 后可能有一个空格前缀（SSE 规范），去掉首行首个空格
          const firstLine = dataLines[0];
          const rest = firstLine.startsWith(' ') ? firstLine.slice(1) : firstLine;
          const data = dataLines.length > 1
            ? [rest, ...dataLines.slice(1)].join('\n')
            : rest;

          if (currentEvent === 'meta') {
            try { callbacks.onMeta?.(JSON.parse(data)); } catch { /* ignore */ }
          } else if (currentEvent === 'token') {
            callbacks.onToken(data);
          } else if (currentEvent === 'done') {
            callbacks.onDone?.();
            finished = true;
          } else if (currentEvent === 'error') {
            callbacks.onError?.(data);
            finished = true;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line === '') {
              // 空行表示一个 SSE 事件结束
              flushEvent();
              currentEvent = '';
              dataLines = [];
              if (finished) return;
            } else if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5));
            }
          }
        }
        // 处理流结束时未结束的事件
        flushEvent();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          callbacks.onError?.(err.message || '未知错误');
        }
      }
    };

    run();

    return { abort: () => controller.abort() };
  },

  suggest: (prefix: string, limit = 10) =>
    request.get<any, BaseResponse<string[]>>('/api/rag/suggest', { params: { prefix, limit } }),
  importQuestions: () =>
    request.post<any, BaseResponse<number>>('/api/rag/import'),
  quickAsk: (data: QuickAskDTO) =>
    request.post<any, BaseResponse<QuickAskResponse>>('/api/rag/quick-ask', data),
  saveToKb: (data: SaveToKbDTO) =>
    request.post<any, BaseResponse<boolean>>('/api/rag/save-to-kb', data),
};

// ========== AI 面试 ==========
export const interviewApi = {
  start: (data: InterviewStartDTO) =>
    request.post<any, BaseResponse<InterviewStartVO>>('/api/interview/start', data),
  answer: (data: InterviewAnswerDTO) =>
    request.post<any, BaseResponse<InterviewAnswerVO>>('/api/interview/answer', data),
  end: (sessionId: number) =>
    request.post<any, BaseResponse<boolean>>(`/api/interview/end/${sessionId}`),
};
