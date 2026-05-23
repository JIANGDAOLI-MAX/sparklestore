import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '笔记Live图生成器 - 小红书种草笔记一键生成',
  description:
    '上传商品图片，AI自动识别商品并生成小红书种草笔记，一键导出笔记Live图，轻松发布小红书。',
  keywords: [
    '小红书',
    '种草笔记',
    '笔记生成',
    'Live图',
    'AI笔记',
    '商品推荐',
  ],
  openGraph: {
    title: '笔记Live图生成器',
    description: '上传商品图片，AI一键生成小红书种草笔记',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
