// test libraries
import { expect } from "chai";
import * as sinon from "sinon";

// dependencies
import * as Koa from "koa";
import * as Router from "koa-router";
import { InversifyKoaServer } from "../src/server";
import { Container, injectable } from "inversify";
import { TYPE } from "../src/constants";

describe("Unit Test: InversifyKoaServer", () => {

    it("should call the configFn before the errorConfigFn", (done) => {
        let middleware = function(ctx: Router.IRouterContext, next: () => Promise<any>) { return; };
        let configFn = sinon.spy((app: Koa) => { app.use(middleware); });
        let errorConfigFn = sinon.spy((app: Koa) => { app.use(middleware); });
        let container = new Container();

        @injectable()
        class TestController {}

        container.bind(TYPE.Controller).to(TestController);
        let server = new InversifyKoaServer(container);

        server.setConfig(configFn)
            .setErrorConfig(errorConfigFn);

        expect(configFn.called).to.eq(false);
        expect(errorConfigFn.called).to.eq(false);

        server.build();

        expect(configFn.calledOnce).to.eqls(true);
        expect(errorConfigFn.calledOnce).to.eqls(true);
        expect(configFn.calledBefore(errorConfigFn)).to.eqls(true);
        done();
    });

    it("Should allow to pass a custom Router instance as config", () => {

        let container = new Container();

        let customRouter = new Router({
        });

        let serverWithDefaultRouter = new InversifyKoaServer(container);
        let serverWithCustomRouter = new InversifyKoaServer(container, customRouter);

        expect((serverWithDefaultRouter as any)._router === customRouter).to.eq(false);
        expect((serverWithCustomRouter as any)._router === customRouter).to.eqls(true);

    });

    it("Should allow to provide custom routing configuration", () => {

        let container = new Container();

        let routingConfig = {
            rootPath: "/such/root/path"
        };

        let serverWithDefaultConfig = new InversifyKoaServer(container);
        let serverWithCustomConfig = new InversifyKoaServer(container, null, routingConfig);

        expect((serverWithCustomConfig as any)._routingConfig).to.eq(routingConfig);
        expect((serverWithDefaultConfig as any)._routingConfig).to.not.eql(
            (serverWithCustomConfig as any)._routingConfig
        );

    });

    it("Should allow to provide a custom Koa application", () => {
        let container = new Container();

        let app = new Koa();

        let serverWithDefaultApp = new InversifyKoaServer(container);
        let serverWithCustomApp = new InversifyKoaServer(container, null, null, app);

        expect((serverWithCustomApp as any)._app).to.eq(app);
        // deeply equal causes error with property URL
        expect((serverWithDefaultApp as any)._app).to.not.equal((serverWithCustomApp as any)._app);
    });
});
