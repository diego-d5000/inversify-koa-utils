import { expect } from "chai";
import { controller, httpMethod, params, authorizeAll, authorize } from "../src/decorators";
import { interfaces } from "../src/interfaces";
import { METADATA_KEY, PARAMETER_TYPE } from "../src/constants";

describe("Unit Test: Controller Decorators", () => {

    it("should add controller metadata to a class when decorated with @controller", (done) => {
        let middleware = [function() { return; }, "foo", Symbol("bar")];
        let path = "foo";

        @controller(path, ...middleware)
        class TestController {}

        let controllerMetadata: interfaces.ControllerMetadata = Reflect.getMetadata("_controller", TestController);

        expect(controllerMetadata.middleware).eql(middleware);
        expect(controllerMetadata.path).eql(path);
        expect(controllerMetadata.target).eql(TestController);
        done();
    });


    it("should add method metadata to a class when decorated with @httpMethod", (done) => {
        let middleware = [function() { return; }, "bar", Symbol("baz")];
        let path = "foo";
        let method = "get";

        class TestController {
            @httpMethod(method, path, ...middleware)
            public test() { return; }

            @httpMethod("foo", "bar")
            public test2() { return; }

            @httpMethod("bar", "foo")
            public test3() { return; }
        }

        let methodMetadata: interfaces.ControllerMethodMetadata[] = Reflect.getMetadata("_controller-method", TestController);

        expect(methodMetadata.length).eql(3);

        let metadata: interfaces.ControllerMethodMetadata = methodMetadata[0];

        expect(metadata.middleware).eql(middleware);
        expect(metadata.path).eql(path);
        expect(metadata.target.constructor).eql(TestController);
        expect(metadata.key).eql("test");
        expect(metadata.method).eql(method);
        done();
    });

    it("should add parameter metadata to a class when decorated with @params", (done) => {
        let middleware = [function() { return; }, "bar", Symbol("baz")];
        let path = "foo";
        let method = "get";
        let methodName = "test";

        class TestController {
            @httpMethod(method, path, ...middleware)
            public test(@params(PARAMETER_TYPE.PARAMS, "id") id: any, @params(PARAMETER_TYPE.PARAMS, "cat") cat: any) { return; }

            @httpMethod("foo", "bar")
            public test2(@params(PARAMETER_TYPE.PARAMS, "dog")dog: any) { return; }

            @httpMethod("bar", "foo")
            public test3() { return; }
        }
        let methodMetadataList: interfaces.ControllerParameterMetadata =
        Reflect.getMetadata(METADATA_KEY.controllerParameter, TestController);
        expect(methodMetadataList.hasOwnProperty("test")).to.eqls(true);

        let paramaterMetadataList: interfaces.ParameterMetadata[] = methodMetadataList[methodName];
        expect(paramaterMetadataList.length).eql(2);

        let paramaterMetadata: interfaces.ParameterMetadata = paramaterMetadataList[0];
        expect(paramaterMetadata.index).eql(0);
        expect(paramaterMetadata.parameterName).eql("id");
        done();
    });

    it("should add authorize metadata to a class when decorated with @authorizeAll", (done) => {
        let requiredRoles = ["role a", "role b"];

        @authorizeAll(...requiredRoles)
        class TestController {}

        let authorizeAllMetadata: interfaces.AuthorizeAllMetadata = Reflect.getMetadata("_authorize-all", TestController);

        expect(authorizeAllMetadata.requiredRoles).eql(requiredRoles);
        expect(authorizeAllMetadata.target).eql(TestController);
        done();
    });


    it("should add authorize metadata to a class when decorated with @authorize", (done) => {
        let requiredRoles = ["role a", "role b"];

        class TestController {
            @authorize(...requiredRoles)
            public test() { return; }

            @authorize("foo", "bar")
            public test2() { return; }

            @authorize("bar", "foo")
            public test3() { return; }
        }

        let authorizeMetadata: interfaces.AuthorizeMetadata[] | any = Reflect.getMetadata("_authorize", TestController);

        expect(Object.keys(authorizeMetadata).length).eql(3);

        let metadata: interfaces.AuthorizeMetadata = authorizeMetadata.test;

        expect(metadata.requiredRoles).eql(requiredRoles);
        expect(metadata.target.constructor).eql(TestController);
        expect(metadata.key).eql("test");
        done();
    });

});
