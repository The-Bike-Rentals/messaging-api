import { Router } from "express";
import { misc } from "@/controllers";
import requestValidator from "@/middlewares/request-validator";
import sessionValidator from "@/middlewares/session-validator";
import { query } from "express-validator";

const router = Router({ mergeParams: true });
router.get(
    "/exists",
    query("jid").isString(),
    query("type").isString(),
    requestValidator,
    sessionValidator,
    misc.exists,
);

export default router;