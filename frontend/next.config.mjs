/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Docker 部署用,生成最小化生产镜像
  // 后端 API 代理,解决跨域
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
