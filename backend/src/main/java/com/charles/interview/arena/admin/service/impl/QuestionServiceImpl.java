package com.charles.interview.arena.admin.service.impl;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.BeanUtils;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.charles.interview.arena.admin.service.QuestionService;
import com.charles.interview.arena.agent.rag.event.QuestionChangedEvent;
import com.charles.interview.arena.agent.rag.event.QuestionChangedEvent.Action;
import com.charles.interview.arena.common.ErrorCode;
import com.charles.interview.arena.exception.ThrowUtils;
import com.charles.interview.arena.mapper.QuestionMapper;
import com.charles.interview.arena.mapper.UserQuestionMasteryMapper;
import com.charles.interview.arena.model.dto.QuestionAddDTO;
import com.charles.interview.arena.model.dto.QuestionQueryDTO;
import com.charles.interview.arena.model.entity.Question;
import com.charles.interview.arena.model.entity.UserQuestionMastery;
import com.charles.interview.arena.model.vo.QuestionVO;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl extends ServiceImpl<QuestionMapper, Question> implements QuestionService {

    private final ApplicationEventPublisher eventPublisher;
    private final UserQuestionMasteryMapper userQuestionMasteryMapper;

    @Override
    public Long addQuestion(QuestionAddDTO dto, Long userId) {
        Question question = new Question();
        BeanUtils.copyProperties(dto, question);
        question.setUserId(userId);
        // 设置默认值(DTO 未传时)
        if (question.getType() == null) {
            question.setType("PROGRAMMING");
        }
        if (question.getDifficulty() == null) {
            question.setDifficulty("MEDIUM");
        }
        if (question.getTimeLimit() == null) {
            question.setTimeLimit(1000);
        }
        if (question.getMemoryLimit() == null) {
            question.setMemoryLimit(256);
        }
        boolean saved = this.save(question);
        ThrowUtils.throwIf(!saved, ErrorCode.OPERATION_ERROR, "题目创建失败");
        // 发布题目新增事件 → RAG 增量入库（Milvus + ES）
        eventPublisher.publishEvent(new QuestionChangedEvent(Action.ADD, question));
        return question.getId();
    }

    @Override
    public Boolean updateQuestion(QuestionAddDTO dto) {
        Question question = new Question();
        BeanUtils.copyProperties(dto, question);
        boolean updated = this.updateById(question);
        ThrowUtils.throwIf(!updated, ErrorCode.OPERATION_ERROR, "题目更新失败");
        // updateById 后 question 可能缺少部分字段，重新查完整对象再发事件
        Question full = this.getById(question.getId());
        if (full != null) {
            eventPublisher.publishEvent(new QuestionChangedEvent(Action.UPDATE, full));
        }
        return true;
    }

    @Override
    public Boolean deleteQuestion(Long id) {
        // 删除前先查出完整对象（逻辑删除后 getById 查不到）
        Question question = this.getById(id);
        boolean removed = this.removeById(id);
        ThrowUtils.throwIf(!removed, ErrorCode.OPERATION_ERROR, "题目删除失败");
        if (question != null) {
            // 发布题目删除事件 → RAG 增量删除（Milvus + ES）
            eventPublisher.publishEvent(new QuestionChangedEvent(Action.DELETE, question));
        }
        return true;
    }

    @Override
    public QuestionVO getQuestionVO(Long id, Long userId) {
        Question question = this.getById(id);
        ThrowUtils.throwIf(question == null, ErrorCode.NOT_FOUND_ERROR, "题目不存在");
        QuestionVO vo = new QuestionVO();
        BeanUtils.copyProperties(question, vo);
        fillMasteryInfo(List.of(vo), userId);
        return vo;
    }

    @Override
    public Page<QuestionVO> listQuestionVOByPage(QuestionQueryDTO dto, Long userId) {
        QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
        queryWrapper.like(StringUtils.isNotBlank(dto.getTitle()),"title", dto.getTitle())
                    .eq(StringUtils.isNotBlank(dto.getType()), "type", dto.getType())
                    .eq(StringUtils.isNotBlank(dto.getDifficulty()), "difficulty", dto.getDifficulty());
        if (dto.getTags() != null && !dto.getTags().isEmpty()) {
            for (String tag : dto.getTags()) {
                queryWrapper.apply("JSON_CONTAINS(tags, {0})", "\"" + tag + "\"");
            }
        }
        Page<Question> page = this.page(new Page<>(dto.getCurrent(), dto.getPageSize()),queryWrapper);

        Page<QuestionVO> voPage = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        List<QuestionVO> voList = page.getRecords().stream().map(q -> {
            QuestionVO vo = new QuestionVO();
            BeanUtils.copyProperties(q, vo);
            return vo;
        }).collect(Collectors.toList());
        fillMasteryInfo(voList, userId);
        voPage.setRecords(voList);
        return voPage;
    }

    /**
     * 批量填充当前用户对题目的掌握信息（复习次数 + 是否已掌握）
     */
    private void fillMasteryInfo(List<QuestionVO> voList, Long userId) {
        if (voList == null || voList.isEmpty() || userId == null) {
            // 未登录时默认 reviewCount=0, mastered=false
            for (QuestionVO vo : voList) {
                vo.setReviewCount(0);
                vo.setMastered(Boolean.FALSE);
            }
            return;
        }

        Set<Long> questionIds = voList.stream()
                .map(QuestionVO::getId)
                .collect(Collectors.toSet());

        List<UserQuestionMastery> masteryList = userQuestionMasteryMapper.selectList(
                new LambdaQueryWrapper<UserQuestionMastery>()
                        .eq(UserQuestionMastery::getUserId, userId)
                        .in(UserQuestionMastery::getQuestionId, questionIds));

        Map<Long, UserQuestionMastery> masteryMap = masteryList.stream()
                .collect(Collectors.toMap(UserQuestionMastery::getQuestionId, m -> m, (a, b) -> a));

        for (QuestionVO vo : voList) {
            UserQuestionMastery mastery = masteryMap.get(vo.getId());
            if (mastery != null) {
                vo.setReviewCount(mastery.getReviewCount() != null ? mastery.getReviewCount() : 0);
                vo.setMastered("MASTERED".equals(mastery.getStatus()));
            } else {
                vo.setReviewCount(0);
                vo.setMastered(Boolean.FALSE);
            }
        }
    }
}
