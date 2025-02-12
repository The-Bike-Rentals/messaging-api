import type { RequestHandler } from "express";
import WhatsappService from "@/whatsapp/service";
import { logger } from "@/utils";
import { GetMessageBodyBasedOnMimeType } from "@/wa-utils";

export const send: RequestHandler = async (req, res, next) => {
	try {
		const { jid, type = "number", message, options } = JSON.parse(req.body.data);
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file provided" });
		const session = WhatsappService.getSession(req.params.sessionId)!;

		const exists = await WhatsappService.validJid(session, jid, type);
		if (!exists) return res.status(400).json({ error: "JID does not exists" });

		const result = await session.sendMessage(jid, GetMessageBodyBasedOnMimeType(req.file, message), options);
		res.status(200).json(result);
	} catch (e) {
		logger.error(e,e?.message);
		next(e);
	}
};