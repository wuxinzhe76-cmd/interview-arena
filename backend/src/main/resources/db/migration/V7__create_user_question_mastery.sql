-- 用户题目掌握记录表（用户手动标记"我学会了"）
CREATE TABLE IF NOT EXISTS user_question_mastery (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL COMMENT '用户 ID',
    question_id BIGINT       NOT NULL COMMENT '题目 ID',
    status      VARCHAR(20)  NOT NULL DEFAULT 'MASTERED' COMMENT 'MASTERED-已掌握, REVIEWING-复习中',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_question (user_id, question_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户题目掌握记录';
