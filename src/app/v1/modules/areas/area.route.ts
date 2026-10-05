import { Router } from "express";
import { Role } from "../../../../../generated/prisma/client";
import { auth } from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { areaValidation } from "./area.validation";
import { AreaController } from "./area.controller";


const router = Router();

// Area routes
router.post(
    "/",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(areaValidation.createAreaSchema),
    AreaController.createArea,
);

router.get(
    "/",
    validateRequest(areaValidation.areaListQuerySchema),
    AreaController.getAllAreas,
);

export const AreaRoutes = router;
