import * as Koa from "koa";
import * as Router from "koa-router";
import { interfaces as inversifyInterfaces } from "inversify";
import { PARAMETER_TYPE } from "./constants";

namespace interfaces {

    export type Middleware = (inversifyInterfaces.ServiceIdentifier<any> | KoaRequestHandler);

    export interface ControllerMetadata {
        path: string;
        middleware: Middleware[];
        target: any;
    }

    export interface ControllerMethodMetadata extends ControllerMetadata {
        method: string;
        key: string;
    }

    export interface ControllerParameterMetadata {
        [methodName: string]: ParameterMetadata[];
    }

    export interface ParameterMetadata {
        parameterName: string;
        index: number;
        type: PARAMETER_TYPE;
    }

    export interface Controller {}

    export interface HandlerDecorator {
        (target: any, key: string, value: any): void;
    }

    export interface ConfigFunction {
        (app: Koa): void;
    }

    export interface RoutingConfig {
        rootPath: string;
    }

    export interface KoaRequestHandler {
        (ctx: Router.IRouterContext, next: () => Promise<any>): any;
    }

}

export { interfaces };
