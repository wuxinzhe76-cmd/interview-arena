package com.charles.interview.arena.model.vo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.Data;

@Data
public class QuestionVO {

    private Long id;
    private String title;
    private String content;
    private String answer;
    private List<String> tags;
    private String type;
    private String difficulty;
    private String template;
    private Integer timeLimit;
    private Integer memoryLimit;
    private Integer acceptedCount;
    private Integer submissionCount;
    private BigDecimal acceptanceRate;

    /** 当前用户复习次数 */
    private Integer reviewCount;

    /** 当前用户是否已标记掌握 */
    private Boolean mastered;

    private Long userId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
