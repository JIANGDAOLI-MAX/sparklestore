import { NextRequest, NextResponse } from "next/server";
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
  S3Storage,
} from "coze-coding-dev-sdk";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

const BEAUTY_PROMPT = `对这张眼部特写照片进行高级美颜+精致眼妆处理，要求：

【美颜增强】
1. 高清磨皮：深度柔肤，平滑所有细纹、毛孔、黑眼圈、暗沉和肤色不均，呈现无瑕奶油肌效果，皮肤通透发光但不塑料
2. 大直径锁边美瞳：给瞳孔添加大直径美瞳效果，直径占虹膜90%以上，必须有清晰的深色锁边圈（外圈深色描边），美瞳颜色以灰色或棕色为主（根据肤色和妆感选择），灰色清冷高级、棕色温柔混血；美瞳纹理细腻有层次，从外圈深色→中间主色→内圈渐淡；必须有明亮的眼神光高光点（白色圆点反光），让眼睛水润有神、深邃迷人
3. 眉毛精修：每根眉毛根根分明清晰可辨，眉形修饰为精致野生眉，立体有型不生硬
4. 清理杂毛：彻底去除眼部周围多余碎发、杂毛，保持眼部区域干净清爽
5. 肤色提亮：眼部周围肤色均匀提亮，消除暗沉，呈现光泽通透感
6. 卧蚕精修：自然突出卧蚕，让眼睛看起来更大更灵动

【精致眼妆】
7. 眼线：沿睫毛根部画一条精致细眼线，眼尾微微上扬拉长，线条流畅自然
8. 眼影：叠加自然大地色系眼影，浅棕色打底+深棕色加深眼窝和眼尾，带有细腻微闪
9. 下眼线/下至：下眼尾轻轻勾勒，打造无辜狗狗眼效果
10. 睫毛强化：让假睫毛更加浓密卷翘，根根分明，呈现完美扇形展开效果

整体要求：妆感精致高级，像专业化妆师的手笔，自然不失精致，不要浓妆艳抹，保持通透质感`;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }

    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }

    // Upload original image to S3 and get URL for image-to-image
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const fileExt = imageFile.name.split(".").pop() || "jpg";
    const fileName = `beautify_input/${Date.now()}_${imageFile.name}`;

    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName,
      contentType: imageFile.type || `image/${fileExt}`,
    });

    const imageUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600,
    });

    // Use image generation client for image-to-image beauty enhancement
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const response = await client.generate({
      prompt: BEAUTY_PROMPT,
      image: imageUrl,
      size: "2K",
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({
        success: true,
        beautifiedImageUrl: helper.imageUrls[0],
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: helper.errorMessages.length > 0 ? helper.errorMessages.join("; ") : "美颜处理失败",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Beautify API error:", error);
    return NextResponse.json(
      { error: "美颜处理出错，请稍后重试" },
      { status: 500 }
    );
  }
}
