import Groq from "groq-sdk";
import { z } from "zod";
import { MODELS } from "./models";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callJson<T extends z.ZodType>(options: {
  model: string;
  system: string;
  user: string;
  schema: T;
  name: string;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required. Add it to .env.local before running a live sample.");
  }

  const groq = new Groq({ apiKey });
  const jsonSchema = z.toJSONSchema(options.schema);
  const models = [options.model, options.model, MODELS.alt];
  let lastError = "Unknown model response error";

  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        temperature: 0.1,
        ...(model.includes("gpt-oss") ? { reasoning_effort: options.effort ?? "low" } : {}),
        messages: [
          { role: "system", content: options.system },
          {
            role: "user",
            content: `${options.user}${lastError !== "Unknown model response error" ? `\n\nYour previous JSON was invalid: ${lastError}. Return corrected JSON only.` : ""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: options.name, schema: jsonSchema, strict: false },
        },
      });

      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("The model returned an empty response.");
      return options.schema.parse(JSON.parse(content));
    } catch (error) {
      const apiError = error as { status?: number; headers?: Record<string, string> | Headers; message?: string };
      lastError = String(apiError.message ?? error).slice(0, 300);
      if (apiError.status === 429) {
        const retryAfter = apiError.headers instanceof Headers
          ? apiError.headers.get("retry-after")
          : apiError.headers?.["retry-after"];
        const seconds = Math.min(10, Math.max(1, Number(retryAfter) || 2));
        await pause(seconds * 1000);
      }
    }
  }

  throw new Error(`Could not produce valid ${options.name} JSON after model retries: ${lastError}`);
}
