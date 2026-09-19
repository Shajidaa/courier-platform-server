import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.route";

const v1Routes: Router = Router();

interface IRoutes {
  path: string;
  router: Router;
}

const routes: IRoutes[] = [
  { path: "/user", router: UserRoutes },
  { path: "/auth", router: AuthRoutes },
];

routes.forEach((route) => {
  v1Routes.use(route.path, route.router);
});

export default v1Routes;
