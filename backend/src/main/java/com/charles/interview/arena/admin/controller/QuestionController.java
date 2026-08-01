package com.charles.interview.arena.admin.controller;

import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.charles.interview.arena.common.BaseResponse;
import com.charles.interview.arena.common.ErrorCode;
import com.charles.interview.arena.common.ResultUtils;
import com.charles.interview.arena.exception.ThrowUtils;
import com.charles.interview.arena.mapper.UserQuestionMasteryMapper;
import com.charles.interview.arena.model.dto.QuestionAddDTO;
import com.charles.interview.arena.model.dto.QuestionQueryDTO;
import com.charles.interview.arena.model.entity.UserQuestionMastery;
import com.charles.interview.arena.model.vo.QuestionVO;
import com.charles.interview.arena.admin.service.QuestionBankQuestionService;
import com.charles.interview.arena.admin.service.QuestionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/question")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;
    private final QuestionBankQuestionService questionBankQuestionService;
    private final UserQuestionMasteryMapper userQuestionMasteryMapper;

    @PostMapping("/add")
    public BaseResponse<Long> add(@Valid @RequestBody QuestionAddDTO dto, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        Long id = questionService.addQuestion(dto, userId);
        return ResultUtils.success(id);
    }

    @PostMapping("/update")
    public BaseResponse<Boolean> update(@Valid @RequestBody QuestionAddDTO dto) {
        Boolean result = questionService.updateQuestion(dto);
        return ResultUtils.success(result);
    }

    @DeleteMapping("/delete/{id}")
    public BaseResponse<Boolean> delete(@PathVariable Long id) {
        Boolean result = questionService.deleteQuestion(id);
        return ResultUtils.success(result);
    }

    @GetMapping("/get/vo/{id}")
    public BaseResponse<QuestionVO> getVO(@PathVariable Long id) {
        QuestionVO vo = questionService.getQuestionVO(id);
        return ResultUtils.success(vo);
    }

    @PostMapping("/list/page/vo")
    public BaseResponse<Page<QuestionVO>> listPageVO(@RequestBody QuestionQueryDTO dto) {
        Page<QuestionVO> page = questionService.listQuestionVOByPage(dto);
        return ResultUtils.success(page);
    }

    // ========== 题库-题目关联管理 ==========

    @PostMapping("/bank/add")
    public BaseResponse<Boolean> addToBank(@RequestParam Long bankId, @RequestParam Long questionId,
                                           HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        Boolean result = questionBankQuestionService.addQuestionToBank(bankId, questionId, userId);
        return ResultUtils.success(result);
    }

    @PostMapping("/bank/batchAdd")
    public BaseResponse<Boolean> batchAddToBank(@RequestParam Long bankId, @RequestBody List<Long> questionIds,
                                                HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        Boolean result = questionBankQuestionService.batchAddQuestionsToBank(bankId, questionIds, userId);
        return ResultUtils.success(result);
    }

    @PostMapping("/bank/batchRemove")
    public BaseResponse<Boolean> batchRemoveFromBank(@RequestParam Long bankId,
                                                     @RequestBody List<Long> questionIds) {
        Boolean result = questionBankQuestionService.batchRemoveQuestionsFromBank(bankId, questionIds);
        return ResultUtils.success(result);
    }

    @GetMapping("/bank/list/{bankId}")
    public BaseResponse<List<QuestionVO>> listByBankId(@PathVariable Long bankId) {
        List<QuestionVO> list = questionBankQuestionService.listQuestionsByBankId(bankId);
        return ResultUtils.success(list);
    }

    // ========== 题目掌握标记（"我学会了"） ==========

    /** 标记题目已掌握 */
    @PostMapping("/mastery/{questionId}")
    public BaseResponse<Boolean> markMastery(@PathVariable Long questionId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        ThrowUtils.throwIf(userId == null, ErrorCode.NOT_LOGIN_ERROR, "未登录");
        // 已存在则不重复插入
        UserQuestionMastery existing = userQuestionMasteryMapper.selectOne(
                new LambdaQueryWrapper<UserQuestionMastery>()
                        .eq(UserQuestionMastery::getUserId, userId)
                        .eq(UserQuestionMastery::getQuestionId, questionId));
        if (existing == null) {
            UserQuestionMastery record = new UserQuestionMastery();
            record.setUserId(userId);
            record.setQuestionId(questionId);
            record.setStatus("MASTERED");
            userQuestionMasteryMapper.insert(record);
        } else if (!"MASTERED".equals(existing.getStatus())) {
            existing.setStatus("MASTERED");
            userQuestionMasteryMapper.updateById(existing);
        }
        return ResultUtils.success(true);
    }

    /** 取消掌握标记 */
    @DeleteMapping("/mastery/{questionId}")
    public BaseResponse<Boolean> unmarkMastery(@PathVariable Long questionId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        ThrowUtils.throwIf(userId == null, ErrorCode.NOT_LOGIN_ERROR, "未登录");
        userQuestionMasteryMapper.delete(new LambdaQueryWrapper<UserQuestionMastery>()
                .eq(UserQuestionMastery::getUserId, userId)
                .eq(UserQuestionMastery::getQuestionId, questionId));
        return ResultUtils.success(true);
    }

    /** 查询题目是否已掌握 */
    @GetMapping("/mastery/{questionId}")
    public BaseResponse<Boolean> checkMastery(@PathVariable Long questionId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        ThrowUtils.throwIf(userId == null, ErrorCode.NOT_LOGIN_ERROR, "未登录");
        Long count = userQuestionMasteryMapper.selectCount(new LambdaQueryWrapper<UserQuestionMastery>()
                .eq(UserQuestionMastery::getUserId, userId)
                .eq(UserQuestionMastery::getQuestionId, questionId)
                .eq(UserQuestionMastery::getStatus, "MASTERED"));
        return ResultUtils.success(count > 0);
    }
}
