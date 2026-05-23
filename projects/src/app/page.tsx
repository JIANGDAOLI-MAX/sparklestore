'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Camera, Upload, Download, RotateCcw, ImagePlus, Eye, Wand2, Check } from 'lucide-react';

// Morandi color palette
const MORANDI_COLORS = [
  '#B8A9C9', '#A3B5A6', '#C4A882', '#9BB5CE',
  '#C9A9A6', '#A6B8C9', '#B5C4B1', '#C9B8A6',
  '#B0C4C9', '#C9B0B5', '#A6C9B8', '#C9C4A6',
  '#B5A6C9', '#C9A6B5', '#A6C9C4', '#C9BBA6',
];

function getRandomMorandiColor() {
  return MORANDI_COLORS[Math.floor(Math.random() * MORANDI_COLORS.length)];
}

export default function HomePage() {
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [enhancedProductImage, setEnhancedProductImage] = useState<string | null>(null);
  const [eyeImage, setEyeImage] = useState<string | null>(null);
  const [eyeImageFile, setEyeImageFile] = useState<File | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [lashInfo, setLashInfo] = useState<Record<string, string> | null>(null);
  const [morandiColor, setMorandiColor] = useState(getRandomMorandiColor());
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [isProductEnhancing, setIsProductEnhancing] = useState(false);
  const [productEnhanced, setProductEnhanced] = useState(false);
  const [autoTryOnTriggered, setAutoTryOnTriggered] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const eyeInputRef = useRef<HTMLInputElement>(null);
  const eyeCameraRef = useRef<HTMLInputElement>(null);
  const liveCardRef = useRef<HTMLDivElement>(null);

  // Auto try-on when both images are uploaded
  useEffect(() => {
    if (productImageFile && eyeImageFile && !autoTryOnTriggered) {
      setAutoTryOnTriggered(true);
      handleTryOn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productImageFile, eyeImageFile]);

  const handleProductUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductImage(URL.createObjectURL(file));
    setProductImageFile(file);
    setEnhancedProductImage(null);
    setProductEnhanced(false);
    setTryOnResult(null);
    setLashInfo(null);
    setAutoTryOnTriggered(false);
  }, []);

  const handleEyeUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEyeImage(URL.createObjectURL(file));
    setEyeImageFile(file);
    setTryOnResult(null);
    setLashInfo(null);
    setAutoTryOnTriggered(false);
  }, []);

  const handleTryOn = async () => {
    if (!productImageFile || !eyeImageFile) return;
    setIsTryOnLoading(true);
    setTryOnResult(null);
    setLashInfo(null);
    try {
      const formData = new FormData();
      formData.append('productImage', productImageFile);
      formData.append('eyeImage', eyeImageFile);

      const res = await fetch('/api/try-on', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.tryOnImageUrl) {
        setTryOnResult(data.tryOnImageUrl);
        if (data.lashInfo) {
          setLashInfo(data.lashInfo);
        }
      } else {
        alert(data.error || '试戴失败，请重试');
      }
    } catch {
      alert('网络错误，请重试');
    } finally {
      setIsTryOnLoading(false);
    }
  };

  const handleProductEnhance = async () => {
    if (!productImageFile) return;
    setIsProductEnhancing(true);
    try {
      const formData = new FormData();
      formData.append('image', productImageFile);
      const res = await fetch('/api/product-bg', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setEnhancedProductImage(data.imageUrl);
        setProductEnhanced(true);
      } else {
        alert(data.error || '产品图生成失败');
      }
    } catch {
      alert('网络错误，请重试');
    } finally {
      setIsProductEnhancing(false);
    }
  };

  const handleDownload = async () => {
    if (!liveCardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(liveCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = `eyelash-tryon-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('下载失败，请重试');
    }
  };

  const handleReset = () => {
    setProductImage(null);
    setProductImageFile(null);
    setEnhancedProductImage(null);
    setEyeImage(null);
    setEyeImageFile(null);
    setTryOnResult(null);
    setLashInfo(null);
    setProductEnhanced(false);
    setAutoTryOnTriggered(false);
    setMorandiColor(getRandomMorandiColor());
  };

  const displayProductImage = enhancedProductImage || productImage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white py-5 px-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Sparkles className="w-7 h-7" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide">睫毛试戴</h1>
            <p className="text-white/80 text-sm mt-0.5">上传睫毛产品图 + 拍张眼部照，AI帮你虚拟试戴</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Product Image Upload */}
          <Card className="border-2 border-dashed border-pink-200 hover:border-pink-400 transition-colors bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ImagePlus className="w-5 h-5 text-pink-500" />
                <h3 className="font-semibold text-gray-700">睫毛产品图</h3>
                {productEnhanced && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> AI产品图
                  </span>
                )}
              </div>
              {productImage ? (
                <div className="relative">
                  <img
                    src={displayProductImage || ''}
                    alt="产品图"
                    className="w-full h-52 object-contain rounded-xl bg-gray-50"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleProductEnhance}
                      disabled={isProductEnhancing}
                      className="bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white text-xs rounded-full shadow-md"
                    >
                      {isProductEnhancing ? (
                        <><span className="animate-spin mr-1">⟳</span>处理中</>
                      ) : (
                        <><ImagePlus className="w-3.5 h-3.5 mr-1" />AI产品图</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => productInputRef.current?.click()}
                      className="text-xs rounded-full"
                    >
                      换一张
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => productInputRef.current?.click()}
                  className="h-52 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50/50 rounded-xl transition-colors"
                >
                  <Upload className="w-10 h-10 text-pink-300 mb-2" />
                  <p className="text-sm text-gray-400">点击上传睫毛产品图</p>
                  <p className="text-xs text-gray-300 mt-1">JPG / PNG / WebP</p>
                </div>
              )}
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProductUpload}
              />
            </CardContent>
          </Card>

          {/* Eye Image Upload */}
          <Card className="border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-700">眼部照片</h3>
                {tryOnResult && (
                  <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> 已试戴
                  </span>
                )}
              </div>
              {eyeImage ? (
                <div className="relative">
                  <img
                    src={tryOnResult || eyeImage}
                    alt="眼部照片"
                    className="w-full h-52 object-contain rounded-xl bg-gray-50"
                  />
                  {isTryOnLoading && (
                    <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
                      <div className="animate-spin w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full mb-2" />
                      <p className="text-sm text-purple-600 font-medium">AI试戴中...</p>
                      <p className="text-xs text-purple-400 mt-1">正在为你佩戴睫毛</p>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => eyeInputRef.current?.click()}
                      className="text-xs rounded-full"
                    >
                      换一张
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-52 flex flex-col items-center justify-center gap-3 rounded-xl">
                  <Camera className="w-10 h-10 text-purple-300 mb-1" />
                  <p className="text-sm text-gray-400">眼部照片</p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        if (eyeCameraRef.current) {
                          eyeCameraRef.current.click();
                        }
                      }}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm rounded-full shadow-md"
                    >
                      <Camera className="w-4 h-4 mr-1.5" />
                      拍照
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (eyeInputRef.current) {
                          eyeInputRef.current.click();
                        }
                      }}
                      className="text-sm rounded-full border-purple-300 text-purple-600 hover:bg-purple-50"
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      从相册选择
                    </Button>
                  </div>
                  <p className="text-xs text-gray-300">上传后自动试戴</p>
                </div>
              )}
              <input
                ref={eyeInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEyeUpload}
              />
              <input
                ref={eyeCameraRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleEyeUpload}
              />
            </CardContent>
          </Card>
        </div>

        {/* Try-on result section */}
        {tryOnResult && (
          <div className="space-y-4">
            {/* Result area: left text + right Live image */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              {/* Left: Info */}
              <div className="md:col-span-2 space-y-4">
                <Card className="bg-white/80 backdrop-blur border-pink-100">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-pink-500" />
                      <h3 className="font-bold text-lg text-gray-800">试戴完成</h3>
                    </div>
                    <p className="text-sm text-gray-500">
                      AI已根据你选择的睫毛产品，为你完成了虚拟试戴。效果包含美瞳、精致眼妆和高清磨皮。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['虚拟试戴', '美瞳效果', '精致眼妆', '高清磨皮', '野生眉形'].map(tag => (
                        <span key={tag} className="px-2.5 py-1 text-xs bg-pink-50 text-pink-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {/* Lash info display */}
                    {lashInfo && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-semibold text-gray-700">AI识别结果</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          {lashInfo.style && (
                            <div className="bg-purple-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">款式</span>
                              <p className="font-medium text-purple-700">{lashInfo.style}</p>
                            </div>
                          )}
                          {lashInfo.color && (
                            <div className="bg-amber-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">颜色</span>
                              <p className="font-medium text-amber-700">{lashInfo.color}</p>
                            </div>
                          )}
                          {lashInfo.curlDegree && (
                            <div className="bg-blue-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">卷翘度</span>
                              <p className="font-medium text-blue-700">{lashInfo.curlDegree}</p>
                            </div>
                          )}
                          {lashInfo.density && (
                            <div className="bg-green-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">浓密度</span>
                              <p className="font-medium text-green-700">{lashInfo.density}</p>
                            </div>
                          )}
                          {lashInfo.length && (
                            <div className="bg-indigo-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">长度</span>
                              <p className="font-medium text-indigo-700">{lashInfo.length}</p>
                            </div>
                          )}
                          {lashInfo.stalkType && (
                            <div className="bg-teal-50 rounded-lg px-2.5 py-1.5">
                              <span className="text-gray-400">梗类型</span>
                              <p className="font-medium text-teal-700">{lashInfo.stalkType}</p>
                            </div>
                          )}
                        </div>
                        {lashInfo.wearEffect && (
                          <p className="text-xs text-gray-500 pt-0.5">佩戴效果：{lashInfo.wearEffect}</p>
                        )}
                      </div>
                    )}
                    <div className="pt-2 space-y-2">
                      <Button
                        onClick={handleTryOn}
                        disabled={isTryOnLoading}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        重新试戴
                      </Button>
                      <Button
                        onClick={handleDownload}
                        variant="outline"
                        className="w-full rounded-full border-pink-200 text-pink-600 hover:bg-pink-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载Live图
                      </Button>
                      <Button
                        onClick={() => setMorandiColor(getRandomMorandiColor())}
                        variant="outline"
                        size="sm"
                        className="w-full rounded-full text-gray-500"
                      >
                        🎨 换个背景颜色
                      </Button>
                      <p className="text-center text-xs text-gray-400 pt-1">虚拟试戴仅供参考</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Live image card */}
              <div className="md:col-span-3 flex flex-col items-center gap-3">
                <div
                  ref={liveCardRef}
                  className="relative w-full max-w-[400px]"
                  style={{ aspectRatio: '3/4' }}
                >
                  {/* Morandi background */}
                  <div
                    className="absolute inset-0 rounded-3xl"
                    style={{ backgroundColor: morandiColor }}
                  />

                  {/* Product image - top left */}
                  <div
                    className="absolute"
                    style={{ top: '6%', left: '4%', width: '55%' }}
                  >
                    <img
                      src={displayProductImage || ''}
                      alt="产品图"
                      crossOrigin="anonymous"
                      className="w-full rounded-xl shadow-md"
                      style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.12)' }}
                    />
                  </div>

                  {/* Try-on result image - bottom right */}
                  <div
                    className="absolute"
                    style={{ bottom: '6%', right: '4%', width: '55%' }}
                  >
                    <img
                      src={tryOnResult}
                      alt="试戴效果"
                      crossOrigin="anonymous"
                      className="w-full rounded-xl"
                      style={{
                        objectFit: 'cover',
                        objectPosition: 'center 35%',
                        aspectRatio: '4/3',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.12)',
                      }}
                    />
                  </div>

                  {/* Lace border decorations */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 300 400"
                    preserveAspectRatio="none"
                  >
                    <g opacity="0.35" fill="white">
                      {/* Top lace */}
                      <path d="M0,8 Q15,0 30,8 Q45,0 60,8 Q75,0 90,8 Q105,0 120,8 Q135,0 150,8 Q165,0 180,8 Q195,0 210,8 Q225,0 240,8 Q255,0 270,8 Q285,0 300,8 L300,0 L0,0 Z" />
                      <path d="M0,6 Q15,14 30,6 Q45,14 60,6 Q75,14 90,6 Q105,14 120,6 Q135,14 150,6 Q165,14 180,6 Q195,14 210,6 Q225,14 240,6 Q255,14 270,6 Q285,14 300,6 L300,0 L0,0 Z" opacity="0.5" />
                      {Array.from({ length: 11 }, (_, i) => (
                        <circle key={`td${i}`} cx={15 + i * 27} cy={5} r="2" />
                      ))}

                      {/* Bottom lace */}
                      <path d="M0,392 Q15,400 30,392 Q45,400 60,392 Q75,400 90,392 Q105,400 120,392 Q135,400 150,392 Q165,400 180,392 Q195,400 210,392 Q225,400 240,392 Q255,400 270,392 Q285,400 300,392 L300,400 L0,400 Z" />
                      <path d="M0,394 Q15,386 30,394 Q45,386 60,394 Q75,386 90,394 Q105,386 120,394 Q135,386 150,394 Q165,386 180,394 Q195,386 210,394 Q225,386 240,394 Q255,386 270,394 Q285,386 300,394 L300,400 L0,400 Z" opacity="0.5" />
                      {Array.from({ length: 11 }, (_, i) => (
                        <circle key={`bd${i}`} cx={15 + i * 27} cy={395} r="2" />
                      ))}

                      {/* Left lace */}
                      <path d="M8,0 Q0,15 8,30 Q0,45 8,60 Q0,75 8,90 Q0,105 8,120 Q0,135 8,150 Q0,165 8,180 Q0,195 8,210 Q0,225 8,240 Q0,255 8,270 Q0,285 8,300 Q0,315 8,330 Q0,345 8,360 Q0,375 8,390 L0,390 L0,0 Z" />
                      <path d="M6,0 Q14,15 6,30 Q14,45 6,60 Q14,75 6,90 Q14,105 6,120 Q14,135 6,150 Q14,165 6,180 Q14,195 6,210 Q14,225 6,240 Q14,255 6,270 Q14,285 6,300 Q14,315 6,330 Q14,345 6,360 Q14,375 6,390 L0,390 L0,0 Z" opacity="0.5" />
                      {Array.from({ length: 14 }, (_, i) => (
                        <circle key={`ld${i}`} cx={5} cy={15 + i * 27} r="2" />
                      ))}

                      {/* Right lace */}
                      <path d="M292,0 Q300,15 292,30 Q300,45 292,60 Q300,75 292,90 Q300,105 292,120 Q300,135 292,150 Q300,165 292,180 Q300,195 292,210 Q300,225 292,240 Q300,255 292,270 Q300,285 292,300 Q300,315 292,330 Q300,345 292,360 Q300,375 292,390 L300,390 L300,0 Z" />
                      <path d="M294,0 Q286,15 294,30 Q286,45 294,60 Q286,75 294,90 Q286,105 294,120 Q286,135 294,150 Q286,165 294,180 Q286,195 294,210 Q286,225 294,240 Q286,255 294,270 Q286,285 294,300 Q286,315 294,330 Q286,345 294,360 Q286,375 294,390 L300,390 L300,0 Z" opacity="0.5" />
                      {Array.from({ length: 14 }, (_, i) => (
                        <circle key={`rd${i}`} cx={295} cy={15 + i * 27} r="2" />
                      ))}

                      {/* Corner flowers */}
                      <circle cx="12" cy="12" r="6" opacity="0.4" />
                      <circle cx="12" cy="12" r="3" opacity="0.6" />
                      <circle cx="288" cy="12" r="6" opacity="0.4" />
                      <circle cx="288" cy="12" r="3" opacity="0.6" />
                      <circle cx="12" cy="388" r="6" opacity="0.4" />
                      <circle cx="12" cy="388" r="3" opacity="0.6" />
                      <circle cx="288" cy="388" r="6" opacity="0.4" />
                      <circle cx="288" cy="388" r="3" opacity="0.6" />
                    </g>
                  </svg>

                  {/* Watermark */}
                  <div
                    className="absolute bottom-2 right-3 pointer-events-none select-none"
                    style={{ opacity: 0.2, fontSize: '11px', color: 'white', fontWeight: 600, letterSpacing: '1px', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                  >
                    眨眨的闪闪好物
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Eye className="w-4 h-4" />
                  <span>Live图预览 · 长按可保存</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading state when try-on is in progress but no result yet */}
        {isTryOnLoading && !tryOnResult && (
          <Card className="bg-white/80 backdrop-blur border-purple-100">
            <CardContent className="p-10 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="animate-spin w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full" />
                <Sparkles className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mt-4">AI正在为你试戴睫毛</h3>
              <p className="text-sm text-gray-400 mt-1">分析产品款式 + 智能佩戴 + 美颜处理</p>
              <div className="flex gap-3 mt-4">
                {['识别睫毛款式', '虚拟佩戴', '美瞳+眼妆', '高清磨皮'].map((step, i) => (
                  <span
                    key={step}
                    className="text-xs px-3 py-1.5 rounded-full bg-purple-50 text-purple-500 animate-pulse"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  >
                    {step}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reset button */}
        {(productImage || eyeImage) && !isTryOnLoading && (
          <div className="flex justify-center">
            <Button
              onClick={handleReset}
              variant="outline"
              className="rounded-full text-gray-500 hover:text-red-500 hover:border-red-200"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重新开始
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
