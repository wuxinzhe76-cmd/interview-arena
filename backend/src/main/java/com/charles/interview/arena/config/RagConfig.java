package com.charles.interview.arena.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.rag.advisor.RetrievalAugmentationAdvisor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.charles.interview.arena.rag.service.HybridDocumentRetriever;
import com.charles.interview.arena.rag.service.RerankDocumentPostProcessor;

@Configuration
public class RagConfig {

    /**
     * 通用 ChatClient（非 RAG 场景使用）
     * <p>
     * 挂载 SimpleLoggerAdvisor 记录 AI 调用日志，不挂 RAG Advisor
     */
    @Bean
    ChatClient chatClient(ChatClient.Builder builder) {
        return builder
                .defaultSystem("你是一个专业的面试教练，基于面试题知识库回答用户问题，回答要准确、有条理。")
                .defaultAdvisors(new SimpleLoggerAdvisor())
                .build();
    }

    /**
     * Advanced RAG Advisor（Modular RAG 框架）
     * <p>
     * 八股映射：
     * - #176 Modular RAG：DAG 图 + 5 模块 + 4 编排模式
     * - #177 框架实现：Spring AI RetrievalAugmentationAdvisor = 模块化 RAG 的 Java 落地
     * <p>
     * 链路：
     * 用户提问 → HybridDocumentRetriever（向量+BM25+RRF 融合 Top-10）
     *           → RerankDocumentPostProcessor（Cross-Encoder 精排 Top-5）
     *           → ContextualQueryAugmenter（自动拼接上下文到 Prompt）
     *           → ChatClient 调通义千问生成
     * <p>
     * vs QuestionAnswerAdvisor（Naive RAG）：
     * - Naive RAG：纯向量检索，一行搞定
     * - Advanced RAG：混合检索 + Rerank，模块可插拔
     */
    @Bean
    RetrievalAugmentationAdvisor ragAdvisor(
            HybridDocumentRetriever hybridDocumentRetriever,
            RerankDocumentPostProcessor rerankDocumentPostProcessor) {
        return RetrievalAugmentationAdvisor.builder()
                .documentRetriever(hybridDocumentRetriever)
                .documentPostProcessors(rerankDocumentPostProcessor)
                .build();
    }
}
