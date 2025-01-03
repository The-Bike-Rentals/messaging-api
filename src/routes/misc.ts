import { Router } from "express";
import { misc } from "@/controllers";
import requestValidator from "@/middlewares/request-validator";
import sessionValidator from "@/middlewares/session-validator";
import { param } from "express-validator";

const router = Router({ mergeParams: true });
router.get(
    "/exists/:jid/:type",
    param("jid").isString(),
    param("type").isString(),
    requestValidator,
    sessionValidator,
    misc.exists,
);

export default router;