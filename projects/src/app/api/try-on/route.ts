import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, ImageGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import type { Message } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// Step 1: LLM精准识别睫毛款式和颜色
const ANALYZE_PROMPT = `你是假睫毛专业鉴定师，请仔细观察产品图中的假睫毛，精准识别以下信息，严格按JSON格式输出（不要输出任何其他内容，不要用markdown代码块包裹）：

{
  "style": "款式名称（必须是以下之一：斜飞款、太阳花、仙子款、猫耳款、婴儿弯、自然款、浓密款、交叉款、Y字款、一字款、朵花款、灵动款，如果都不匹配就写最接近的）",
  "styleDesc": "款式特征详细描述（30字以内，描述睫毛的形状走向特点，如：眼尾拉长上扬、扇形展开、中间长两端短等）",
  "curlDegree": "卷翘度（必须是以下之一：J卷-微翘、C卷-自然卷、D卷-浓密卷、L卷-上扬直角，根据图片判断最接近的）",
  "length": "长度级别（必须是以下之一：短款6-8mm、中款9-11mm、长款12-14mm、超长款15mm+）",
  "density": "浓密度（必须是以下之一：稀疏自然、中等适中、浓密饱满、超浓密）",
  "color": "睫毛颜色（必须是以下之一：纯黑色、深棕色、深灰色、透明梗黑毛、棕色渐变，根据图片准确判断）",
  "colorDetail": "颜色详细描述（20字以内，如：乌黑浓亮、深棕偏暖、灰黑色调等）",
  "stalkType": "梗的类型（必须是以下之一：透明梗、黑梗、棉线梗、极细梗）",
  "clusterShape": "簇型特征（20字以内，如：单簇细长、多簇交叠、渐变长度等）",
  "wearEffect": "佩戴后预期效果描述（30字以内，如：眼尾飞翘拉长眼型、圆润放大双眼、自然灵动如天生等）",
  "keyFeature": "最突出的一个特征（15字以内，如：眼尾超长飞翘、根根分明、浓密如扇等）"
}`;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (
      !contentType.includes('multipart/form-data') &&
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 });
    }

    const formData = await request.formData();
    const productImageFile = formData.get('productImage') as File | null;
    const eyeImageFile = formData.get('eyeImage') as File | null;

    if (!productImageFile || !eyeImageFile) {
      return NextResponse.json({ error: '请上传产品图和眼部照片' }, { status: 400 });
    }

    // Upload both images to S3
    const productBuffer = Buffer.from(await productImageFile.arrayBuffer());
    const eyeBuffer = Buffer.from(await eyeImageFile.arrayBuffer());

    const productFileName = `tryon_product/${Date.now()}_${productImageFile.name}`;
    const eyeFileName = `tryon_eye/${Date.now()}_${eyeImageFile.name}`;

    const [productFileKey, eyeFileKey] = await Promise.all([
      storage.uploadFile({
        fileContent: productBuffer,
        fileName: productFileName,
        contentType: productImageFile.type || 'image/jpeg',
      }),
      storage.uploadFile({
        fileContent: eyeBuffer,
        fileName: eyeFileName,
        contentType: eyeImageFile.type || 'image/jpeg',
      }),
    ]);

    const [productImageUrl, eyeImageUrl] = await Promise.all([
      storage.generatePresignedUrl({ key: productFileKey, expireTime: 3600 }),
      storage.generatePresignedUrl({ key: eyeFileKey, expireTime: 3600 }),
    ]);

    // Step 1: LLM精准识别睫毛款式和颜色
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    const llmClient = new LLMClient(config, customHeaders);
    const analyzeMessages: Message[] = [
      { role: 'system', content: ANALYZE_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请仔细观察这张假睫毛产品图，精准识别睫毛的款式、颜色和所有特征。' },
          { type: 'image_url', image_url: { url: productImageUrl, detail: 'high' } },
        ],
      },
    ];

    const llmResponse = await llmClient.invoke(analyzeMessages, {
      model: 'doubao-seed-1-8-251228',
    });

    let lashInfo: Record<string, string> = {};
    try {
      const text = llmResponse.content || JSON.stringify(llmResponse);
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        lashInfo = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // 解析失败时使用默认信息
    }

    // Step 2: 根据识别结果构建精准试戴prompt
    const style = lashInfo.style || '自然款';
    const styleDesc = lashInfo.styleDesc || '自然展开';
    const curlDegree = lashInfo.curlDegree || 'C卷-自然卷';
    const length = lashInfo.length || '中款9-11mm';
    const density = lashInfo.density || '中等适中';
    const color = lashInfo.color || '纯黑色';
    const colorDetail = lashInfo.colorDetail || '乌黑浓亮';
    const stalkType = lashInfo.stalkType || '透明梗';
    const clusterShape = lashInfo.clusterShape || '单簇细长';
    const wearEffect = lashInfo.wearEffect || '自然放大双眼';
    const keyFeature = lashInfo.keyFeature || '根根分明';

    const tryOnPrompt = `专业假睫毛试戴效果图生成。参照标准美妆试戴图风格：正面平视拍摄、均匀柔和室内光、干净底妆、极淡眼妆突出睫毛效果。

【第一步：仔细观察产品图中的假睫毛】
- 睫毛有多少簇？每簇多少根？间距多大？稀疏还是浓密？
- 长度分布：均匀长度还是前短后长渐变？哪段最长？
- 卷翘弧度：微翘还是明显上卷？
- 颜色深浅和色调
- 排列方式：平行/交叉/扇形/斜向一侧？
- 梗的粗细颜色，簇的形状

【第二步：精准还原产品款式到眼部】

🎯 密度还原（最关键）：
- 产品稀疏→试戴必须同样稀疏，根根分明有呼吸感，不能多加一根
- 产品浓密→试戴必须同样浓密饱满，不能少一簇
- ${density}：必须完全一致

🎯 款式还原：
- 款式：${style}，${styleDesc}
- 斜飞/苏妲己→眼尾明显拉长上扬，前短后长渐变，妩媚猫眼
- 太阳花→均匀扇形放射展开，中间最长，圆润放大
- 仙子款→长短交错排列，灵动感，轻盈飘逸
- 猫耳款→眼尾三角区集中上挑，猫系凌厉
- 婴儿弯/婴儿直→几乎平直微弯，像天生睫毛，无辜减龄
- 小雏菊→极短极稀疏，根根分明，通透清透感
- 汪汪狗→中间长两边短放射型，圆圆无辜眼
- 浓密款→整体浓密饱满如扇面，深邃
- 流苏小猫耳→稀疏分散，毛尖轻盈如流苏
- 交叉款→多方向交叉，立体层次
- Y字款→末端分叉如Y字

🎯 卷度还原（自然为主）：
- ${curlDegree}，但弧度偏自然柔和
- 睫毛要有自然下垂的弧度，像天生弯曲，不要太翘太卷
- 尖端微微自然弯曲即可，不要J形C形明显上翘
- 婴儿直/婴儿弯款→几乎平直，只最尖端微微弯曲

🎯 长度还原（偏短自然）：
- ${length}，整体偏短偏日常
- 不要舞台夸张长度，像日常佩戴的自然感
- 产品偏长时适当缩短

🎯 颜色还原：
- 睫毛颜色：${color}（${colorDetail}），绝对不改色
- 梗类型：${stalkType}
- 簇型：${clusterShape}
- 佩戴效果：${wearEffect}，最突出特征：${keyFeature}

【第三步：标准美妆试戴图风格】
- 拍摄角度：正面平视，镜头正对眼睛，完整展示睫毛形态
- 光线：均匀柔和室内光，正面或侧前方打光，无明显阴影，清晰展现睫毛细节
- 眼妆极简（突出睫毛）：
  · 极细内眼线贴睫毛根部，几乎看不出，仅提亮轮廓
  · 眼影几乎不画或极淡米棕色轻扫，似有似无
  · 无亮片无彩色眼影，裸感为主
- 底妆：均匀轻薄底妆，遮盖黑眼圈和瑕疵，干净整洁，但保留皮肤自然纹理不过度磨皮
- 自然美瞳：小直径，棕色/深咖色，边缘自然渐变融入原有虹膜，不要锁边圈不要外圈描边，中心有清透明亮眼神光
- 眉毛保持原样仅轻微修整杂毛，轻微清除眼部碎发

⚠️ 绝对禁止：
- 禁止稀疏→浓密，禁止浓密→稀疏
- 禁止改色，禁止换款式，禁止增减簇数
- 禁止过度美颜失真
- 禁止大直径美瞳和锁边圈
- 禁止睫毛过长过翘的夸张效果
- 禁止明显J形C形上翘
- 禁止浓妆艳抹
- 禁止侧面角度拍摄，必须是正面平视

最终效果：专业美妆试戴展示图，试戴后的睫毛必须和产品图是同一副，正面平视拍摄，光线均匀柔和，干净底妆+极淡眼妆突出睫毛，整体自然逼真无AI感`;

    // Step 3: AI图片生成
    const imageClient = new ImageGenerationClient(config, customHeaders);

    const response = await imageClient.generate({
      prompt: tryOnPrompt,
      image: [productImageUrl, eyeImageUrl],
      size: '2K',
      watermark: false,
    });

    const helper = imageClient.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({
        success: true,
        tryOnImageUrl: helper.imageUrls[0],
        lashInfo: lashInfo,
      });
    } else {
      return NextResponse.json({
        error: '试戴生成失败，请重试',
        details: helper.errorMessages,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Try-on API error:', error);
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 });
  }
}
