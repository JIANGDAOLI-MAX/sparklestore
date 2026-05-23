import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils, S3Storage } from "coze-coding-dev-sdk";
import type { Message } from "coze-coding-dev-sdk";

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

const SYSTEM_PROMPT = `你是一位小红书爆款笔记创作者，专注假睫毛/美睫品类，擅长写出极具情绪价值、让人忍不住种草的文案。

请根据用户上传的【假睫毛产品图】和【上眼效果图】，生成一篇小红书种草笔记，严格按以下JSON格式输出（不要输出任何其他内容，不要用markdown代码块包裹）：

{
  "title": "笔记标题（15字以内，带emoji，要有种草感和情绪冲击力）",
  "subtitle": "副标题（一句话亮点，20字以内）",
  "productName": "产品名称（根据图片推测，如：XX品牌假睫毛）",
  "productStyle": "产品款式名称（根据图片中假睫毛的形状风格推测，如：斜飞苏妲己、太阳花、仙子睫毛、猫耳睫毛、婴儿弯等）",
  "effectDesc": "上眼效果描述（20字以内，如：自然仙气、甜酷辣妹等）",
  "highlights": ["卖点1", "卖点2", "卖点3"],
  "content": "笔记正文（150-300字，情绪价值拉满，要有场景代入感，让读者产生'我也想要这种眼睛'的冲动。适当使用emoji，分段清晰）",
  "tags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5", "#标签6"],
  "rating": 4.8
}

文案方向要求：
1. 标题要有"贴完睫毛后整个人都不一样了"的情绪冲击力
2. 正文重点写贴睫毛前后的心情变化、自信感提升、被夸的惊喜等情绪价值
3. 场景代入：约会、通勤、自拍、聚会等具体场景
4. 语气像闺蜜安利，亲切自然，不要太官方
5. 卖点围绕：自然不假、贴了像天生、手残党友好、持久不翘边等
6. 标签覆盖品类词+场景词+情绪词（如#假睫毛推荐 #贴睫毛自信 #约会必备）
7. 严格按照JSON格式输出，不要有多余文字`;

async function uploadImageToS3(file: File, prefix: string): Promise<string> {
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${prefix}/${Date.now()}_${file.name}`;

  const fileKey = await storage.uploadFile({
    fileContent: imageBuffer,
    fileName,
    contentType: file.type || `image/${fileExt}`,
  });

  return storage.generatePresignedUrl({
    key: fileKey,
    expireTime: 3600,
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      return NextResponse.json(
        { error: "请上传图片" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const productImage = formData.get("productImage") as File | null;
    const eyeImage = formData.get("eyeImage") as File | null;

    if (!productImage || !eyeImage) {
      return NextResponse.json(
        { error: "请同时上传产品图和上眼效果图" },
        { status: 400 }
      );
    }

    // Upload both images to S3
    const [productImageUrl, eyeImageUrl] = await Promise.all([
      uploadImageToS3(productImage, "product_images"),
      uploadImageToS3(eyeImage, "eye_images"),
    ]);

    // Use LLM to analyze both images and generate note
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages: Message[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请根据这两张图片生成小红书种草笔记。第一张是假睫毛产品图，第二张是上眼效果图。",
          },
          {
            type: "image_url",
            image_url: {
              url: productImageUrl,
              detail: "high",
            },
          },
          {
            type: "image_url",
            image_url: {
              url: eyeImageUrl,
              detail: "high",
            },
          },
        ],
      },
    ];

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: "doubao-seed-1-8-251228",
            temperature: 0.85,
          });

          // Send image URLs
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "images",
                productImageUrl,
                eyeImageUrl,
              })}\n\n`
            )
          );

          let fullContent = "";
          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              fullContent += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "content", text })}\n\n`
                )
              );
            }
          }

          // Parse the full content as JSON
          try {
            let cleanContent = fullContent.trim();
            if (cleanContent.startsWith("```")) {
              cleanContent = cleanContent
                .replace(/^```(?:json)?\s*\n?/, "")
                .replace(/\n?```\s*$/, "");
            }
            const noteData = JSON.parse(cleanContent);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  data: noteData,
                })}\n\n`
              )
            );
          } catch {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  data: { rawContent: fullContent },
                })}\n\n`
              )
            );
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: "生成笔记时出错，请重试",
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试" },
      { status: 500 }
    );
  }
}
