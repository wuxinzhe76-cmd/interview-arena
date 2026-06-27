package com.charles.interview.arena.rag.controller;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.charles.interview.arena.common.BaseResponse;
import com.charles.interview.arena.common.ErrorCode;
import com.charles.interview.arena.common.ResultUtils;
import com.charles.interview.arena.exception.ThrowUtils;
import com.charles.interview.arena.model.dto.RagChatDTO;
import com.charles.interview.arena.model.entity.User;
import com.charles.interview.arena.rag.model.RagChatResponse;
import com.charles.interview.arena.rag.service.QuestionSearchService;
import com.charles.interview.arena.rag.service.RagService;
import com.charles.interview.arena.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/rag")
@RequiredArgsConstructor
public class RagController {

    private final RagService ragService;
    private final QuestionSearchService questionSearchService;
    private final UserService userService;

    /**
     * ETL 离线索引：将面试题导入 Milvus 向量库 + ES 倒排索引（仅管理员）
     */
    @PostMapping("/import")
    public BaseResponse<Integer> importQuestionsToVectorStore(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        User user = userService.getById(userId);
        ThrowUtils.throwIf(!"admin".equals(user.getRole()),
                ErrorCode.NO_AUTH_ERROR, "无权限，仅管理员可操作");
        int count = ragService.importQuestionsToVectorStore();
        return ResultUtils.success(count);
    }

    /**
     * 在线 RAG 问答：查询改写 → 混合检索 → Rerank → 去重重排 → 通义千问生成 + 引用标注（登录即可用）
     */
    @PostMapping("/chat")
    public BaseResponse<RagChatResponse> chat(@Valid @RequestBody RagChatDTO ragChatDTO, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        ThrowUtils.throwIf(userId == null, ErrorCode.NOT_LOGIN_ERROR, "未登录");
        RagChatResponse response = ragService.ragChat(ragChatDTO.getMessage());
        return ResultUtils.success(response);
    }

    /**
     * 搜索栏 autocomplete：题目标题前缀匹配（ES match_phrase_prefix）
     */
    @GetMapping("/suggest")
    public BaseResponse<List<String>> suggest(
            @RequestParam String prefix,
            @RequestParam(defaultValue = "10") int limit) {
        List<String> suggestions = questionSearchService.suggest(prefix, limit);
        return ResultUtils.success(suggestions);
    }
}
