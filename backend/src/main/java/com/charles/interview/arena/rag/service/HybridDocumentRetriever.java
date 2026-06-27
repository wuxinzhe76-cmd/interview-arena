package com.charles.interview.arena.rag.service;

import java.util.List;

import org.springframework.ai.document.Document;
import org.springframework.ai.rag.Query;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 混合检索适配器（Spring AI DocumentRetriever 接口 → HybridRetriever）
 * <p>
 * 作用：让 HybridRetriever 能被 RetrievalAugmentationAdvisor 框架调用
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class HybridDocumentRetriever implements DocumentRetriever {

    private final HybridRetriever hybridRetriever;

    @Override
    public List<Document> retrieve(Query query) {
        return hybridRetriever.retrieve(query.text());
    }
}
