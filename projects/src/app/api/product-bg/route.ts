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

const PRODUCT_BG_PROMPT = `对这张产品照片进行专业商品抠图+实景纯色背景合成处理，要求：

【产品抠图】
1. 精准识别主体产品（假睫毛/美妆产品），将产品完整抠出
2. 抠图边缘要干净利落，保留产品所有细节（睫毛纤维、包装纹理、反光等）
3. 去除原图所有背景，只保留产品本身

【实景纯色背景合成】
4. 为产品生成一个实景纯色背景，要求：
   - 背景必须是纯色实景，不要渐变、不要花纹、不要光斑粒子
   - 实景背景选项（随机选择一种）：
     · 奶白色/米白色丝绒布料桌面，细腻的布料纹理
     · 浅灰色大理石桌面，天然石材纹理
     · 浅粉色/奶咖色亚麻布桌面，自然布纹质感
     · 燕麦色绒面桌面，柔软绒毛质感
     · 奶油白陶瓷台面，光滑温润质感
   - 背景必须是纯色，只有材质纹理，不要任何装饰物、花瓣、光斑
5. 产品自然摆放在桌面上，略微倾斜15度，呈现日常放置感
6. 自然的顶光照明，柔和不刺眼，产品有轻微阴影增加立体感
7. 整体画面干净简洁，产品突出，背景质感高级不抢戏

整体要求：像专业商品摄影师在纯色实景桌面上拍摄的作品，干净高级`;

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
    const fileName = `product_bg_input/${Date.now()}_${imageFile.name}`;

    const fileKey = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName,
      contentType: imageFile.type || `image/${fileExt}`,
    });

    const imageUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600,
    });

    // Use image generation client for image-to-image product background
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const response = await client.generate({
      prompt: PRODUCT_BG_PROMPT,
      image: imageUrl,
      size: "2K",
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({
        success: true,
        productBgImageUrl: helper.imageUrls[0],
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            helper.errorMessages.length > 0
              ? helper.errorMessages.join("; ")
              : "产品图处理失败",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Product BG API error:", error);
    return NextResponse.json(
      { error: "产品图处理出错，请稍后重试" },
      { status: 500 }
    );
  }
}
