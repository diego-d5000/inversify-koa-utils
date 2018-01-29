const TYPE = {
    AuthProvider: Symbol.for("AuthProvider"),
    Controller: Symbol.for("Controller")
};

const METADATA_KEY = {
    authorize: "_authorize",
    authorizeAll: "_authorize-all",
    controller: "_controller",
    controllerMethod: "_controller-method",
    controllerParameter: "_controller-parameter"
};

export enum PARAMETER_TYPE {
    REQUEST,
    RESPONSE,
    PARAMS,
    QUERY,
    BODY,
    HEADERS,
    COOKIES,
    NEXT,
    CTX
}

const DEFAULT_ROUTING_ROOT_PATH = "/";

export { TYPE, METADATA_KEY, DEFAULT_ROUTING_ROOT_PATH };
