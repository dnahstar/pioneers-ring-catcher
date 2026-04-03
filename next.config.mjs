/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 사이트 배포용 (GitHub Pages)
  images: {
    unoptimized: true, // 이미지 최적화 끄기 (빌드 에러 방지)
  },
  // 필요한 경우 basePath: '/프로젝트이름' 추가
};

export default nextConfig;
