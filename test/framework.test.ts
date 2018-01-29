import "reflect-metadata";
import * as sinon from "sinon";
import * as supertest from "supertest";
import { expect } from "chai";
import * as inversify from "inversify";
import * as Koa from "koa";
import * as Router from "koa-router";
import * as bodyParser from "koa-bodyparser";
import { injectable, inject, Container } from "inversify";
import { interfaces } from "../src/interfaces";
import { InversifyKoaServer } from "../src/server";
import {
    controller, httpMethod, all, httpGet, httpPost, httpPut, httpPatch,
    httpHead, httpDelete, request, response, params, requestParam,
    requestBody, queryParam, requestHeaders, cookies,
    next, context, authorize, authorizeAll
} from "../src/decorators";
import { TYPE, PARAMETER_TYPE } from "../src/constants";
import { BaseMiddleware } from "../src/base_middleware";

describe("Integration Tests:", () => {
    let server: InversifyKoaServer;
    let container: inversify.interfaces.Container;

    beforeEach((done) => {
        // refresh container and container
        container = new Container();
        done();
    });

    describe("Routing & Request Handling:", () => {

        it("should work for basic koa cascading (using async/await)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    const start = new Date();
                    await nextFunc();
                    const ms = new Date().valueOf() - start.valueOf();
                    ctx.set("X-Response-Time", `${ms}ms`);
                }

                @httpGet("/") public getTest2(ctx: Router.IRouterContext) {
                    ctx.body = "Hello World";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "Hello World", done);
        });

        it("should work for basic koa cascading (using promises)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    const start = new Date();
                    return nextFunc().then(() => {
                        const ms = new Date().valueOf() - start.valueOf();
                        ctx.set("X-Response-Time", `${ms}ms`);
                        ctx.body = "Hello World";
                    });
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "Hello World", done);
        });

        it("should work for methods which call nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    nextFunc();
                }

                @httpGet("/") public getTest2(ctx: Router.IRouterContext) {
                    ctx.body = "GET";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for async methods which call nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    return new Promise(((resolve) => {
                        setTimeout(() => {
                            nextFunc();
                            resolve();
                        }, 100);
                    }));
                }

                @httpGet("/") public getTest2(ctx: Router.IRouterContext) {
                    ctx.body = "GET";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for async methods called by nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    await nextFunc();
                }

                @httpGet("/") public getTest2(ctx: Router.IRouterContext) {
                    return new Promise(((resolve) => {
                        setTimeout(resolve, 100, "GET");
                    }));
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for each shortcut decorator", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
                @httpPost("/") public postTest(ctx: Router.IRouterContext) { ctx.body = "POST"; }
                @httpPut("/") public putTest(ctx: Router.IRouterContext) { ctx.body = "PUT"; }
                @httpPatch("/") public patchTest(ctx: Router.IRouterContext) { ctx.body = "PATCH"; }
                @httpHead("/") public headTest(ctx: Router.IRouterContext) { ctx.body = "HEAD"; }
                @httpDelete("/") public deleteTest(ctx: Router.IRouterContext) { ctx.body = "DELETE"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            let deleteFn = () => { agent.delete("/").expect(200, "DELETE", done); };
            let head = () => { agent.head("/").expect(200, "HEAD", deleteFn); };
            let patch = () => { agent.patch("/").expect(200, "PATCH", head); };
            let put = () => { agent.put("/").expect(200, "PUT", patch); };
            let post = () => { agent.post("/").expect(200, "POST", put); };
            let get = () => { agent.get("/").expect(200, "GET", post); };

            get();
        });

        it("should work for more obscure HTTP methods using the httpMethod decorator", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpMethod("propfind", "/") public getTest(ctx: Router.IRouterContext) { ctx.body = "PROPFIND"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .propfind("/")
                .expect(200, "PROPFIND", done);
        });

        it("should use returned values as response", (done) => {
            let result = { "hello": "world" };

            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { return result; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, JSON.stringify(result), done);
        });

        it("should use custom router passed from configuration", () => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("endpoint") public get() {
                    return "Such Text";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            const customRouter = new Router({
                prefix: "/api"
            });

            server = new InversifyKoaServer(container, customRouter);
            const app = server.build().listen();

            const expectedSuccess = supertest(app)
                .get("/api/endpoint")
                .expect(200, "Such Text");

            const expectedNotFound1 = supertest(app)
                .get("/otherpath/endpoint")
                .expect(404);

            const expectedNotFound2 = supertest(app)
                .get("/endpoint")
                .expect(404);

            return Promise.all([
                expectedSuccess,
                expectedNotFound1,
                expectedNotFound2
            ]);

        });

        it("should use custom routing configuration", () => {
            @injectable()
            @controller("/ping")
            class TestController {
                @httpGet("/endpoint") public get() {
                    return "pong";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, { rootPath: "/api/v1" });

            return supertest(server.build().listen())
                .get("/api/v1/ping/endpoint")
                .expect(200, "pong");
        });

        it("Should set the principal from auth provider into koa context", () => {
            let myPrincipal: interfaces.Principal = {
                details: null,
                isAuthenticated: () => Promise.resolve(false),
                isInRole: (role: string) => Promise.resolve(false),
                isResourceOwner: (resourceId: any) => Promise.resolve(false)
            };
            @injectable()
            class MyAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    return Promise.resolve(myPrincipal);
                }
            }
            @injectable()
            @controller("/ping")
            class TestController {
                @httpGet("/endpoint") public get(@context() ctx: Router.IRouterContext) {
                    return ctx.state.principal === myPrincipal ? "correct principal" : "wrong principal";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, MyAuthProvider);

            return supertest(server.build().listen())
                .get("/ping/endpoint")
                .expect(200, "correct principal");
        });
    });


    describe("Middleware:", () => {
        let result: string;
        let middleware: any = {
            a: function (ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                result += "a";
                nextFunc();
            },
            b: function (ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                result += "b";
                nextFunc();
            },
            c: function (ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                result += "c";
                nextFunc();
            }
        };
        let spyA = sinon.spy(middleware, "a");
        let spyB = sinon.spy(middleware, "b");
        let spyC = sinon.spy(middleware, "c");

        beforeEach((done) => {
            result = "";
            spyA.reset();
            spyB.reset();
            spyC.reset();
            done();
        });

        it("should call method-level middleware correctly (GET)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/", spyA, spyB, spyC) public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (POST)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPost("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "POST"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.post("/")
                .expect(200, "POST", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (PUT)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPut("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "PUT"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.put("/")
                .expect(200, "PUT", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (PATCH)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPatch("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "PATCH"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.patch("/")
                .expect(200, "PATCH", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (HEAD)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpHead("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "HEAD"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.head("/")
                .expect(200, "HEAD", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (DELETE)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpDelete("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "DELETE"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.delete("/")
                .expect(200, "DELETE", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (ALL)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @all("/", spyA, spyB, spyC) public postTest(ctx: Router.IRouterContext) { ctx.body = "ALL"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            let agent = supertest(server.build().listen());

            agent.get("/")
                .expect(200, "ALL", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call controller-level middleware correctly", (done) => {
            @injectable()
            @controller("/", spyA, spyB, spyC)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call injected controller-level BaseMiddleware correctly", (done) => {

            const serviceType = Symbol.for("TestService");
            @injectable()
            class TestService {}
            container.bind<TestService>(serviceType).to(TestService);

            const middlewareType = Symbol.for("TestMiddleware");
            @injectable()
            class TestMiddleware extends BaseMiddleware {
                @inject(serviceType)
                private readonly testService: TestService;

                public handler(ctx: Router.IRouterContext, nextFunc: () => Promise<any>) {
                    result += "d";
                    nextFunc();
                }
            }
            container.bind<TestMiddleware>(middlewareType).to(TestMiddleware);

            @injectable()
            @controller("/", spyA, spyB, spyC, middlewareType)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abcd");
                    done();
                });
        });

        it("should call server-level middleware correctly", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);

            server.setConfig((app) => {
                app.use(spyA);
                app.use(spyB);
                app.use(spyC);
            });

            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call all middleware in correct order", (done) => {
            @injectable()
            @controller("/", spyB)
            class TestController {
                @httpGet("/", spyC) public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);

            server.setConfig((app) => {
                app.use(spyA);
            });

            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should resolve controller-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/", symbolId, strId)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }

            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<interfaces.KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<interfaces.KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            let agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });

        it("should resolve method-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/", symbolId, strId)
                public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }

            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<interfaces.KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<interfaces.KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            let agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });

        it("should compose controller- and method-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/", symbolId)
            class TestController {
                @httpGet("/", strId)
                public getTest(ctx: Router.IRouterContext) { ctx.body = "GET"; }
            }

            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<interfaces.KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<interfaces.KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            let agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });
    });


    describe("Parameters:", () => {
        it("should bind a method parameter to the url parameter of the web request", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the request object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") public getTest( @request() req: Koa.Request) {
                    return req.url;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/GET")
                .expect(200, "/GET", done);
        });

        it("should bind a method parameter to the response object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest( @response() res: Koa.Response) {
                    return res.body = "foo";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the context object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest( @context() ctx: Koa.Context) {
                    return ctx.body = "foo";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to a query parameter", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest( @queryParam("id") id: string) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .query("id=foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the request body", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPost("/") public getTest( @requestBody() reqBody: string) {
                    return reqBody;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            server.setConfig((app) => {
                app.use(bodyParser());
            });
            let body = { foo: "bar" };
            supertest(server.build().listen())
                .post("/")
                .send(body)
                .expect(200, body, done);
        });

        it("should bind a method parameter to the request headers", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest( @requestHeaders("testhead") headers: any) {
                    return headers;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .set("TestHead", "foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to a cookie", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getCookie( @cookies("cookie") cookie: any, ctx: Router.IRouterContext) {
                    if (cookie) {
                        ctx.body = cookie;
                    } else {
                        ctx.body = ":(";
                    }
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            server.setConfig((app) => {
                app.use(function (ctx, nextFunc) {
                    ctx.cookies.set("cookie", "hey", { httpOnly: false });
                    nextFunc();
                });
            });
            supertest(server.build().listen())
                .get("/")
                .expect("set-cookie", "cookie=hey; path=/", done);
        });

        it("should bind a method parameter to the next function", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest( @next() nextFunc: any) {
                    let err = new Error("foo");
                    await nextFunc();
                }
                @httpGet("/") public getResult() {
                    return "foo";
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });
    });


    describe("Authorization:", () => {
        it("should respond with 401 if there is no auth provider and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 401 if provided principal is not authenticated and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(false),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 403 if provided principal is not in role and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => {
                            if (role === "role a") {
                                return Promise.resolve(true);
                            }
                            return Promise.resolve(false);
                        },
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll("role a", "role b")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(403, done);
        });

        it("should invoke controller if provided principal is authorized according to roles in @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll("role a", "role b")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should invoke controller if provided principal is authenticated and no roles are enforced in @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(false),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        // =====
        it("should respond with 401 if there is no auth provider and method is decorated with @authorize", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") @authorize() public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 401 if provided principal is not authenticated and method is decorated with @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(false),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") @authorize() public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 403 if provided principal is not in role and method is decorated with @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => {
                            if (role === "role a") {
                                return Promise.resolve(true);
                            }
                            return Promise.resolve(false);
                        },
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") @authorize("role a", "role b") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(403, done);
        });

        it("should invoke controller if provided principal is authorized according to roles in @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") @authorize("role a", "role b") public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should invoke controller if provided principal is authenticated and no roles are enforced in @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements interfaces.AuthProvider {
                public getPrincipal(ctx: Router.IRouterContext): Promise<interfaces.Principal> {
                    let principal: interfaces.Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(false),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                // tslint:disable-next-line:max-line-length
                @httpGet(":id") @authorize() public getTest( @requestParam("id") id: string, ctx: Router.IRouterContext) {
                    return id;
                }
            }
            container.bind<interfaces.Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });
    });

});
