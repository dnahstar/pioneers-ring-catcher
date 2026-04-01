/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 배포를 위해 반드시 필요
  basePath: '/pioneers-ring-catcher', // 상세 주소 경로를 인식하게 만드는 핵심!
  images: {
    unoptimized: true, // 이미지 최적화 에러 방지
  },
  trailingSlash: true, // 경로가 꼬이는 걸 방지하기 위해 유지
};

export default nextConfig;
