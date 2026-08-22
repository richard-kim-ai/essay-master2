import type { Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

export async function runQuestionBankTrashCleanup(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const result = await db.purgeExpiredQuestionBankTrash();
    return res.json({ ok: true, ...result, taskUid: user.taskUid, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[QuestionBankCleanup] Failed", error);
    return res.status(500).json({
      error: message,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
