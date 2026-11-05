/**
 * ============================================================================
 * 多模态内容的小工具
 * ============================================================================
 *
 * 一条消息的 content 有两种形态：
 *   - 纯文本： "你好"
 *   - 片段数组：[{type:"text"}, {type:"image_url"}]  （带图片时必须用这种）
 *
 * 这个文件把“判断 string / 数组”“取文本”“数图片”“估算 token”这些琐事
 * 收在一处，避免每个调用点都写一遍类型判断。
 */
import type {
  ChatMessage,
  ContentPart,
  ImageContentPart,
  MessageContent,
  TextContentPart,
} from "./types.ts";
import { estimateTokens } from "../util.ts";

/** 一张待发送的图片（前端上传后转成 data URL）。 */
export interface IncomingImage {
  /** 文件名，仅用于界面展示和审计，不发给模型。 */
  name?: string;
  /** data:image/png;base64,... */
  dataUrl: string;
}

export function isImagePart(part: ContentPart): part is ImageContentPart {
  return part.type === "image_url";
}

export function isTextPart(part: ContentPart): part is TextContentPart {
  return part.type === "text";
}

/** 从 content 里取纯文本；图片会被忽略（它的信息在 URL 里）。 */
export function contentToText(content: MessageContent | null | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n");
}

/** 取出所有图片片段。 */
export function contentImages(content: MessageContent | null | undefined): ImageContentPart[] {
  if (!Array.isArray(content)) return [];
  return content.filter(isImagePart);
}

/** 给标题/事件表用的短描述：有文字用文字，纯图片写 [N 张图片]。 */
export function contentSummary(content: MessageContent | null | undefined): string {
  const text = contentToText(content).trim();
  const images = contentImages(content).length;
  if (text) return images > 0 ? `${text}（+${images} 张图片）` : text;
  return images > 0 ? `[${images} 张图片]` : "";
}

/**
 * 估算一条多模态内容的 token。
 *
 * 图片的真实 token 取决于分辨率、模型和厂商，没人能在本地精确算出来。
 * 这里按每张 1000 token 粗估——足够让上下文预算“知道图片很贵”，
 * 又不至于为了精确计数引入几 MB 的分词器/图像处理库。
 */
export function estimateContentTokens(content: MessageContent | null | undefined): number {
  if (typeof content === "string") return estimateTokens(content);
  if (!Array.isArray(content)) return 0;
  let tokens = 0;
  for (const part of content) {
    if (part.type === "text") tokens += estimateTokens(part.text);
    else tokens += 1000;
  }
  return tokens;
}

/**
 * 把“文本 + 上传图片”拼成模型能吃的 content。
 *
 * 小优化：只有文字时仍然返回字符串，保持历史文件可读、兼容旧逻辑。
 */
export function buildUserContent(text: string, images: IncomingImage[]): MessageContent {
  const trimmed = text.trim();
  const parts: ContentPart[] = [];
  if (trimmed) parts.push({ type: "text", text: trimmed });
  for (const image of images) {
    parts.push({ type: "image_url", image_url: { url: image.dataUrl, detail: "auto" } });
  }
  if (parts.length === 1 && parts[0]!.type === "text") return trimmed;
  return parts;
}

/** 给压缩请求等“纯文本场景”用：把多模态历史拍平成文字。 */
export function flattenMessageContent(message: ChatMessage): string {
  const text = contentToText(message.content);
  const images = contentImages(message.content).length;
  if (images === 0) return text;
  return `${text}${text ? "\n" : ""}[用户附带了 ${images} 张图片，图片内容未包含在文本摘要里]`;
}
