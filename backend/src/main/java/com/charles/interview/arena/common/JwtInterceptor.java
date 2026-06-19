package com.charles.interview.arena.common;

import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.HandlerInterceptor;

import com.charles.interview.arena.exception.BusinessException;

import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class JwtInterceptor implements HandlerInterceptor {

    private final StringRedisTemplate stringRedisTemplate;

    // 放行白名单(公开接口,无需登录)
    private static final List<String> WHITE_LIST = List.of(
            "/api/user/register",
            "/api/user/login",
            "/api/user/refresh",
            "/api/health",
            "/swagger-ui",
            "/v3/api-docs",
            // 题目浏览公开(像 LeetCode 一样,未登录也能看题)
            "/api/question/list/page/vo",
            "/api/question/get/vo",
            "/api/questionBank/list/page/vo",
            "/api/questionBank/get/vo"
    );

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) {
        String path = request.getRequestURI();

        // 1. 白名单放行
        if (WHITE_LIST.stream().anyMatch(path::startsWith)) {
            return true;
        }

        // 2. 从请求头取 token
        String token = request.getHeader("Authorization");
        if (token == null || token.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR.getCode(), "未提供 token");
        }

        // 3. 解析 token
        Claims claims = JwtUtil.parseToken(token);
        if (claims == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR.getCode(), "token 无效或已过期");
        }

        // 4. 校验 Redis 中 token 是否匹配（防止用过期 token 重复使用）
        Long userId = Long.parseLong(claims.getSubject());
        String redisKey = "access:" + userId;
        String redisToken = stringRedisTemplate.opsForValue().get(redisKey);
        if (redisToken == null || !redisToken.equals(token)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR.getCode(), "token 已失效，请重新登录");
        }

        // 5. 将 userId 存入 request，后续 Controller 可用
        request.setAttribute("userId", userId);
        return true;
    }
}