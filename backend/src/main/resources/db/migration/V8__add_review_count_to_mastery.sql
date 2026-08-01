-- 为用户题目掌握记录表增加复习次数字段
ALTER TABLE user_question_mastery
    ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0 COMMENT '复习次数（查看答案/练习一次累加一次）';
