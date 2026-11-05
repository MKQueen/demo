/**
 * ============================================================================
 * 工具注册表 + 参数校验器
 * ============================================================================
 *
 * 这个文件解决一个非常现实的问题：**模型会写错参数**。
 *
 * 模型输出的 arguments 是一个 JSON 字符串，常见翻车现场：
 *   - JSON 语法错（少引号、多逗号）
 *   - 参数名拼错（path 写成 file_path）
 *   - 类型错（limit 给了 "10" 字符串）
 *   - 缺必填参数
 *
 * 如果你直接 JSON.parse 然后调用工具，程序就崩了。
 * 正确做法是：解析 → 校验 → 把错误信息作为 tool 结果喂回模型，让它自己改。
 * 这就是 Agent 的“自我纠错”能力来源之一。
 *
 * 生产项目一般用 zod / ajv 做校验；这里手写一个 JSON Schema 子集校验器，
 * 大概 100 行，看懂它你就理解所有校验库在干什么。
 */
import type { JSONSchema, ToolDefinition } from "../llm/types.ts";
import type { Tool } from "./types.ts";

export interface ValidationResult {
  ok: boolean;
  /** 校验通过时的参数对象（原样返回）。 */
  value: Record<string, unknown>;
  /** 校验失败的原因列表，会直接喂给模型。 */
  errors: string[];
}

/**
 * 校验工具参数。
 * 只实现 Agent 工具真正用得到的 JSON Schema 子集，够用且好读。
 */
export function validateArgs(schema: JSONSchema, raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      value: {},
      errors: ["参数必须是一个 JSON 对象，例如 {\"path\": \"src/a.ts\"}"],
    };
  }

  checkValue(schema, raw, "参数", errors);
  return { ok: errors.length === 0, value: raw as Record<string, unknown>, errors };
}

function checkValue(
  schema: JSONSchema,
  value: unknown,
  path: string,
  errors: string[],
): void {
  // 枚举优先判断
  if (schema.enum) {
    const matched = schema.enum.some((option) => Object.is(option, value));
    if (!matched) {
      const options = schema.enum.map((v) => JSON.stringify(v)).join(" | ");
      errors.push(`${path} 必须是 ${options} 之一，收到的是 ${JSON.stringify(value)}`);
    }
    return;
  }

  const type = schema.type;
  if (!type) return;

  switch (type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${path} 应该是一个对象，收到的是 ${Array.isArray(value) ? "数组" : typeof value}`);
        return;
      }
      const obj = value as Record<string, unknown>;

      for (const key of schema.required ?? []) {
        if (obj[key] === undefined) {
          errors.push(`缺少必填参数 "${key}"`);
        }
      }

      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        if (obj[key] !== undefined) {
          checkValue(propSchema, obj[key], `${path}.${key}`, errors);
        }
      }

      // additionalProperties: false 时拒绝未知字段。
      // 这能挡住“模型自创参数名”的情况，并告诉它正确名字。
      if (schema.additionalProperties === false) {
        const allowed = Object.keys(schema.properties ?? {});
        for (const key of Object.keys(obj)) {
          if (!allowed.includes(key)) {
            errors.push(
              `出现未知参数 "${key}"（该工具只接受：${allowed.join(", ") || "无参数"}）`,
            );
          }
        }
      }
      return;
    }

    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path} 应该是一个数组，收到的是 ${typeof value}`);
        return;
      }
      if (schema.items) {
        value.forEach((item, index) => {
          checkValue(schema.items!, item, `${path}[${index}]`, errors);
        });
      }
      return;
    }

    case "string": {
      if (typeof value !== "string") {
        errors.push(`${path} 应该是字符串，收到的是 ${typeof value}`);
        return;
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path} 长度不能小于 ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path} 长度不能大于 ${schema.maxLength}`);
      }
      return;
    }

    case "integer": {
      if (!Number.isInteger(value)) {
        errors.push(`${path} 应该是整数，收到的是 ${JSON.stringify(value)}`);
        return;
      }
      checkRange(schema, value as number, path, errors);
      return;
    }

    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${path} 应该是数字，收到的是 ${JSON.stringify(value)}`);
        return;
      }
      checkRange(schema, value, path, errors);
      return;
    }

    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push(`${path} 应该是 true 或 false，收到的是 ${JSON.stringify(value)}`);
      }
      return;
    }

    case "null": {
      if (value !== null) {
        errors.push(`${path} 应该是 null`);
      }
      return;
    }
  }
}

function checkRange(schema: JSONSchema, value: number, path: string, errors: string[]): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path} 不能小于 ${schema.minimum}`);
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push(`${path} 不能大于 ${schema.maximum}`);
  }
}

/** 把错误列表拼成一段模型能读懂的文字。 */
export function formatValidationErrors(errors: string[]): string {
  return (
    "参数校验失败：\n" +
    errors.map((e) => `- ${e}`).join("\n") +
    "\n请修正参数后重新调用这个工具。"
  );
}

/**
 * 工具注册表。
 *
 * 为什么要注册表而不是到处 import 函数？
 * 因为 Agent 需要一份“当前允许使用的工具清单”：
 *  - 转成 tools 定义发给模型（toDefinitions）
 *  - 按名字查找并执行（get）
 *  - plan 模式/子 Agent 只要提供一个子集（filterBy）
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具名重复：${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return [...this.tools.values()];
  }

  /** 取一个子集，用于 plan 模式、子 Agent 等场景。 */
  filterBy(names: string[]): ToolRegistry {
    const registry = new ToolRegistry();
    for (const name of names) {
      const tool = this.tools.get(name);
      if (tool) registry.register(tool);
    }
    return registry;
  }

  /** 转成发给模型的 tools 数组。 */
  toDefinitions(): ToolDefinition[] {
    return this.all().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  get names(): string[] {
    return [...this.tools.keys()];
  }
}
