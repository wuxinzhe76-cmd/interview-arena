package com.charles.interview.arena.admin.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import com.charles.interview.arena.model.dto.QuestionAddDTO;
import com.charles.interview.arena.model.dto.QuestionQueryDTO;
import com.charles.interview.arena.model.entity.Question;
import com.charles.interview.arena.model.vo.QuestionVO;

public interface QuestionService extends IService<Question> {

    /**
     * 创建题目
     */
    Long addQuestion(QuestionAddDTO dto, Long userId);

    /**
     * 更新题目
     */
    Boolean updateQuestion(QuestionAddDTO dto);

    /**
     * 删除题目(逻辑删除)
     */
    Boolean deleteQuestion(Long id);

    /**
     * 获取题目VO(脱敏)
     *
     * @param id     题目ID
     * @param userId 当前用户ID(可为空)
     */
    QuestionVO getQuestionVO(Long id, Long userId);

    /**
     * 分页查询题目列表(支持标题模糊 + 标签筛选 + 类型/难度过滤)
     *
     * @param dto    查询条件
     * @param userId 当前用户ID(可为空)
     */
    Page<QuestionVO> listQuestionVOByPage(QuestionQueryDTO dto, Long userId);
}
