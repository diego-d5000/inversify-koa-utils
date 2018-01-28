import * as Koa from "koa";
import * as Router from "koa-router";
import * as inversify from "inversify";
import { interfaces } from "./interfaces";
import { TYPE, METADATA_KEY, DEFAULT_ROUTING_ROOT_PATH, PARAMETER_TYPE } from "./constants";
import { BaseMiddleware } from "./base_middleware";

/**
 * Wrapper for the koa server.
 */
export class InversifyKoaServer {

    private _router: Router;
    private _container: inversify.interfaces.Container;
    private _app: Koa;
    private _configFn: interfaces.ConfigFunction;
    private _errorConfigFn: interfaces.ConfigFunction;
    private _routingConfig: interfaces.RoutingConfig;
    private _AuthProvider: { new(): interfaces.AuthProvider};

    /**
     * Wrapper for the koa server.
     *
     * @param container Container loaded with all controllers and their dependencies.
     */
    constructor(
        container: inversify.interfaces.Container,
        customRouter?: Router,
        routingConfig?: interfaces.RoutingConfig,
        customApp?: Koa,
        authProvider?: { new(): interfaces.AuthProvider} | null
    ) {
        this._container = container;
        this._router = customRouter || new Router();
        this._routingConfig = routingConfig || {
            rootPath: DEFAULT_ROUTING_ROOT_PATH
        };
        this._app = customApp || new Koa();
        if (authProvider) {
            this._AuthProvider = authProvider;
            container.bind<interfaces.AuthProvider>(TYPE.AuthProvider)
                     .to(this._AuthProvider);
        }
    }

    /**
     * Sets the configuration function to be applied to the application.
     * Note that the config function is not actually executed until a call to InversifyKoaServer.build().
     *
     * This method is chainable.
     *
     * @param fn Function in which app-level middleware can be registered.
     */
    public setConfig(fn: interfaces.ConfigFunction): InversifyKoaServer {
        this._configFn = fn;
        return this;
    }

    /**
     * Sets the error handler configuration function to be applied to the application.
     * Note that the error config function is not actually executed until a call to InversifyKoaServer.build().
     *
     * This method is chainable.
     *
     * @param fn Function in which app-level error handlers can be registered.
     */
    public setErrorConfig(fn: interfaces.ConfigFunction): InversifyKoaServer {
        this._errorConfigFn = fn;
        return this;
    }

    /**
     * Applies all routes and configuration to the server, returning the Koa application.
     */
    public build(): Koa {
        const _self = this;

        // at very first middleware set the principal to the context state
        this._app.use(async (ctx: Router.IRouterContext, next: () => Promise<any>) => {
            ctx.state.principal = await _self._getCurrentPrincipal(ctx);
            await next();
        });

        // register server-level middleware before anything else
        if (this._configFn) {
            this._configFn.apply(undefined, [this._app]);
        }

        this.registerControllers();

        // register error handlers after controllers
        if (this._errorConfigFn) {
            this._errorConfigFn.apply(undefined, [this._app]);
        }

        return this._app;
    }

    private registerControllers() {
        // set prefix route in config rootpath
        if (this._routingConfig.rootPath !== DEFAULT_ROUTING_ROOT_PATH) {
            this._router.prefix(this._routingConfig.rootPath);
        }

        let controllers: interfaces.Controller[] = this._container.getAll<interfaces.Controller>(TYPE.Controller);

        controllers.forEach((controller: interfaces.Controller) => {

            let controllerMetadata: interfaces.ControllerMetadata = Reflect.getOwnMetadata(
                METADATA_KEY.controller,
                controller.constructor
            );

            let methodMetadata: interfaces.ControllerMethodMetadata[] = Reflect.getOwnMetadata(
                METADATA_KEY.controllerMethod,
                controller.constructor
            );

            let parameterMetadata: interfaces.ControllerParameterMetadata = Reflect.getOwnMetadata(
                METADATA_KEY.controllerParameter,
                controller.constructor
            );

            if (controllerMetadata && methodMetadata) {
                let controllerMiddleware = this.resolveMiddleware(...controllerMetadata.middleware);

                methodMetadata.forEach((metadata: interfaces.ControllerMethodMetadata) => {
                    let paramList: interfaces.ParameterMetadata[] = [];
                    if (parameterMetadata) {
                        paramList = parameterMetadata[metadata.key] || [];
                    }
                    let handler = this.handlerFactory(controllerMetadata.target.name, metadata.key, paramList);
                    let routeMiddleware = this.resolveMiddleware(...metadata.middleware);
                    this._router[metadata.method](
                        `${controllerMetadata.path}${metadata.path}`,
                        ...controllerMiddleware,
                        ...routeMiddleware,
                        handler
                    );
                });
            }
        });

        this._app.use(this._router.routes());
    }

    private resolveMiddleware(...middleware: interfaces.Middleware[]): interfaces.KoaRequestHandler[] {
        return middleware.map(middlewareItem => {
            if (this._container.isBound(middlewareItem)) {

                type MiddlewareInstance = interfaces.KoaRequestHandler | BaseMiddleware;
                const middlewareInstance = this._container.get<MiddlewareInstance>(middlewareItem);

                if (middlewareInstance instanceof BaseMiddleware) {
                    const _self = this;
                    return function(ctx: Router.IRouterContext, next: () => Promise<any>) {
                        return middlewareInstance.handler(ctx, next);
                    };
                } else {
                    return middlewareInstance;
                }

            } else {
                return middlewareItem as interfaces.KoaRequestHandler;
            }
        });
    }

    private handlerFactory(controllerName: any, key: string,
        parameterMetadata: interfaces.ParameterMetadata[]): interfaces.KoaRequestHandler {
        // this function works like another top middleware to extract and inject arguments
        return async (ctx: Router.IRouterContext, next: () => Promise<any>) => {
            let args = this.extractParameters(ctx, next, parameterMetadata);
            let result: any = await this._container.getNamed(TYPE.Controller, controllerName)[key](...args);

            if (result && result instanceof Promise) {
                // koa handle promises
                return result;
            } else if (result && !ctx.headerSent) {
                ctx.body = result;
            }
        };
    }

    private extractParameters(ctx: Router.IRouterContext, next: () => Promise<any>,
        params: interfaces.ParameterMetadata[]): any[] {
        let args = [];
        if (!params || !params.length) {
            return [ctx, next];
        }
        for (let item of params) {

            switch (item.type) {
                default: args[item.index] = ctx; break; // response
                case PARAMETER_TYPE.RESPONSE: args[item.index] = this.getParam(ctx.response, null, item.parameterName); break;
                case PARAMETER_TYPE.REQUEST: args[item.index] = this.getParam(ctx.request, null, item.parameterName); break;
                case PARAMETER_TYPE.NEXT: args[item.index] = next; break;
                case PARAMETER_TYPE.CTX: args[item.index] = this.getParam(ctx, null, item.parameterName); break;
                case PARAMETER_TYPE.PARAMS: args[item.index] = this.getParam(ctx, "params", item.parameterName); break;
                case PARAMETER_TYPE.QUERY: args[item.index] = this.getParam(ctx, "query", item.parameterName); break;
                case PARAMETER_TYPE.BODY: args[item.index] = this.getParam(ctx.request, "body", item.parameterName); break;
                case PARAMETER_TYPE.HEADERS: args[item.index] = this.getParam(ctx.request, "headers", item.parameterName); break;
                case PARAMETER_TYPE.COOKIES: args[item.index] = this.getParam(ctx, "cookies", item.parameterName); break;
            }

        }
        args.push(ctx, next);
        return args;
    }

    private getParam(source: any, paramType: string, name: string) {
        let param = source[paramType] || source;
        return param[name] || this.checkQueryParam(paramType, param, name);
    }

    private checkQueryParam(paramType: string, param: any, name: string) {
        if (paramType === "query") {
            return undefined;
        } if (paramType === "cookies") {
            return param.get(name);
        } else {
            return param;
        }
    }

    private async _getCurrentPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
        if (this._AuthProvider !== undefined) {
            const authProvider = this._container.get<interfaces.AuthProvider>(TYPE.AuthProvider);
            return await authProvider.getPrincipal(ctx);
        } else {
            return Promise.resolve<interfaces.Principal>({
                details: null,
                isAuthenticated: () => Promise.resolve(false),
                isInRole: (role: string) => Promise.resolve(false),
                isResourceOwner: (resourceId: any) => Promise.resolve(false)
            });
        }
    }
}
