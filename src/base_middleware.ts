import { injectable } from "inversify";
import * as Router from "koa-router";
import { interfaces } from "./interfaces";

@injectable()
export abstract class BaseMiddleware implements BaseMiddleware {
    public abstract handler(
        ctx: Router.IRouterContext,
        next: () => Promise<any>
    ): any;
}
