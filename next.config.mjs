/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. GitHub Pages 배포를 위한 정적 HTML 내보내기 설정
  output: 'export',

  // 2. 이미지 최적화 비활성화 (정적 배포 시 필수)
  images: {
    unoptimized: true,
  },

  // 3. 슬래시(/) 처리 방식 설정 (경로 인식 오류 방지)
  trailingSlash: true,

  // 4. (중요) 레포지토리 이름이 dnahstar.github.io가 아닌 
  // 프로젝트 단위(예: dnahstar.github.io/ring-game)라면 아래 주석을 해제하고 이름을 적으세요.
  // basePath: '/ring-game', 
};

export default nextConfig;
