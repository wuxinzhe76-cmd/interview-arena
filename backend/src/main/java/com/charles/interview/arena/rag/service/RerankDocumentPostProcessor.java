package com.charles.interview.arena.rag.service;

import java.util.List;

import org.springframework.ai.document.Document;
import org.springframework.ai.rag.Query;
import org.springframework.ai.rag.postretrieval.document.DocumentPostProcessor;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Rerank 后处理器（Spring AI DocumentPostProcessor 接口 → RerankService）
 * <p>
 * 作用：在 RetrievalAugmentationAdvisor 框架中，检索完成后、Prompt 拼接前，对文档重排序
 * <p>
 * 八股映射：
 * - #7 Post-Retrieval 阶段：Cross-Encoder 精排
 * - 两阶段架构：召回 Top-10（Bi-Encoder）→ 精排 Top-5（Cross-Encoder）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RerankDocumentPostProcessor implements DocumentPostProcessor {

    private final RerankService rerankService;

    private static final int RERANK_TOP_N = 5;

    @Override
    public List<Document> process(Query query, List<Document> documents) {
        return rerankService.rerank(query.text(), documents, RERANK_TOP_N);
    }
}
