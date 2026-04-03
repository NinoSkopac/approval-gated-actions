import { z } from "zod";

const trimmedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

function dedupeEmails(values: string[]): string[] {
  return [...new Set(values)];
}

const emailArraySchema = z
  .array(trimmedEmailSchema)
  .default([])
  .transform((values) => dedupeEmails(values));

const optionalNonEmptyStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value.length > 0 ? value : undefined;
  });

export const OpenClawEmailModeSchema = z.enum([
  "send_now",
  "schedule_send",
  "create_draft"
]);

export const OpenClawEmailActionInputSchema = z
  .object({
    mode: OpenClawEmailModeSchema,
    to: emailArraySchema.optional().default([]),
    cc: emailArraySchema.optional().default([]),
    bcc: emailArraySchema.optional().default([]),
    subject: z.string().trim().default(""),
    text: optionalNonEmptyStringSchema,
    html: optionalNonEmptyStringSchema,
    schedule: z
      .object({
        sendAt: z.string().datetime({ offset: true }),
        timezone: z.string().trim().min(1)
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.text && !value.html) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Either text or html content is required."
      });
    }

    if (value.mode === "schedule_send" && !value.schedule) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schedule"],
        message: "schedule is required when mode is schedule_send."
      });
    }

    if (value.mode !== "schedule_send" && value.schedule) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schedule"],
        message: "schedule is only allowed when mode is schedule_send."
      });
    }

    if ((value.mode === "send_now" || value.mode === "schedule_send") && value.to.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "At least one to recipient is required for send_now and schedule_send."
      });
    }
  });
