# inversify-koa-utils

[![Join the chat at https://gitter.im/inversify/InversifyJS](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/inversify/InversifyJS?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://secure.travis-ci.org/diego-d5000/inversify-koa-utils.svg?branch=master)](https://travis-ci.org/diego-d5000/inversify-koa-utils)
[![Test Coverage](https://codeclimate.com/github/diego-d5000/inversify-koa-utils/badges/coverage.svg)](https://codeclimate.com/github/diego-d5000/inversify-koa-utils/coverage)
[![npm version](https://badge.fury.io/js/inversify-koa-utils.svg)](http://badge.fury.io/js/inversify-koa-utils)
[![Dependencies](https://david-dm.org/diego-d5000/inversify-koa-utils.svg)](https://david-dm.org/diego-d5000/inversify-koa-utils#info=dependencies)
[![img](https://david-dm.org/diego-d5000/inversify-koa-utils/dev-status.svg)](https://david-dm.org/diego-d5000/inversify-koa-utils/#info=devDependencies)
[![img](https://david-dm.org/diego-d5000/inversify-koa-utils/peer-status.svg)](https://david-dm.org/diego-d5000/inversify-koa-utils/#info=peerDependenciess)
[![Known Vulnerabilities](https://snyk.io/test/github/diego-d5000/inversify-koa-utils/badge.svg)](https://snyk.io/test/github/diego-d5000/inversify-koa-utils)

[![NPM](https://nodei.co/npm/inversify-koa-utils.png?downloads=true&downloadRank=true)](https://nodei.co/npm/inversify-koa-utils/)
[![NPM](https://nodei.co/npm-dl/inversify-koa-utils.png?months=9&height=3)](https://nodei.co/npm/inversify-koa-utils/)

inversify-koa-utils is a module based on [inversify-express-utils](https://github.com/inversify/inversify-express-utils). This module has utilities for koa 2 applications development using decorators and IoC Dependency Injection (with inversify)

## Installation
You can install `inversify-koa-utils` using npm:

```
$ npm install inversify inversify-koa-utils reflect-metadata --save
```

The `inversify-koa-utils` type definitions are included in the npm module and require TypeScript 2.0.
Please refer to the [InversifyJS documentation](https://github.com/inversify/InversifyJS#installation) to learn more about the installation process.

## The Basics

### Step 1: Decorate your controllers
To use a class as a "controller" for your koa app, simply add the `@controller` decorator to the class. Similarly, decorate methods of the class to serve as request handlers.
The following example will declare a controller that responds to `GET /foo'.

```ts
import * as Koa from 'koa';
import { interfaces, Controller, Get, Post, Delete } from 'inversify-koa-utils';
import { injectable, inject } from 'inversify';

@controller('/foo')
@injectable()
export class FooController implements interfaces.Controller {

    constructor( @inject('FooService') private fooService: FooService ) {}

    @httpGet('/')
    private index(ctx: Router.IRouterContext , next: () => Promise<any>): string {
        return this.fooService.get(ctx.query.id);
    }

    @httpGet('/basickoacascading')
    private koacascadingA(ctx: Router.IRouterContext, nextFunc: () => Promise<any>): string {
        const start = new Date();
        await nextFunc();
        const ms = new Date().valueOf() - start.valueOf();
        ctx.set("X-Response-Time", `${ms}ms`);
    }

    @httpGet('/basickoacascading')
    private koacascadingB(ctx: Router.IRouterContext , next: () => Promise<any>): string {
        ctx.body = "Hello World";
    }

    @httpGet('/')
    private list(@queryParams('start') start: number, @queryParams('count') cound: number): string {
        return this.fooService.get(start, count);
    }

    @httpPost('/')
    private async create(@response() res: Koa.Response) {
        try {
            await this.fooService.create(req.body)
            res.body = 201
        } catch (err) {
            res.status = 400 
            res.body = { error: err.message }
        }
    }

    @httpDelete('/:id')
    private delete(@requestParam("id") id: string, @response() res: Koa.Response): Promise<void> {
        return this.fooService.delete(id)
            .then(() => res.body = 204)
            .catch((err) => {
                res.status = 400
                res.body = { error: err.message }
            })
    }
}
```

### Step 2: Configure container and server
Configure the inversify container in your composition root as usual.

Then, pass the container to the InversifyKoaServer constructor. This will allow it to register all controllers and their dependencies from your container and attach them to the koa app.
Then just call server.build() to prepare your app.

In order for the InversifyKoaServer to find your controllers, you must bind them to the `TYPE.Controller` service identifier and tag the binding with the controller's name.
The `Controller` interface exported by inversify-koa-utils is empty and solely for convenience, so feel free to implement your own if you want.

```ts
import * as bodyParser from 'koa-bodyparser';

import { Container } from 'inversify';
import { interfaces, InversifyKoaServer, TYPE } from 'inversify-koa-utils';

// set up container
let container = new Container();

// note that you *must* bind your controllers to Controller
container.bind<interfaces.Controller>(TYPE.Controller).to(FooController).whenTargetNamed('FooController');
container.bind<FooService>('FooService').to(FooService);

// create server
let server = new InversifyKoaServer(container);
server.setConfig((app) => {
  // add body parser
  app.use(bodyParser());
});

let app = server.build();
app.listen(3000);
```

## InversifyKoaServer
A wrapper for an koa Application.

### `.setConfig(configFn)`
Optional - exposes the koa application object for convenient loading of server-level middleware.

```ts
import * as morgan from 'koa-morgan';
// ...
let server = new InversifyKoaServer(container);

server.setConfig((app) => {
    var logger = morgan('combined')
    app.use(logger);
});
```

### `.setErrorConfig(errorConfigFn)`
Optional - like `.setConfig()`, except this function is applied after registering all app middleware and controller routes.

```ts
let server = new InversifyKoaServer(container);
server.setErrorConfig((app) => {
    app.use((ctx, next) => {
        console.error(err.stack);
        ctx.status = 500
        ctx.body = 'Something broke!';
    });
});
```

### `.build()`
Attaches all registered controllers and middleware to the koa application. Returns the application instance.

```ts
// ...
let server = new InversifyKoaServer(container);
server
    .setConfig(configFn)
    .setErrorConfig(errorConfigFn)
    .build()
    .listen(3000, 'localhost', callback);
```

## Using a custom Router
It is possible to pass a custom `Router` instance to `InversifyKoaServer`:

```ts

import * as Router from 'koa-router';

let container = new Container();

let router = new Router({
    prefix: '/api',
});

let server = new InversifyKoaServer(container, router);
```

By default server will serve the API at `/` path, but sometimes you might need to use different root namespace, for
example all routes should start with `/api/v1`. It is possible to pass this setting via routing configuration to
`InversifyKoaServer`

```ts
let container = new Container();

let server = new InversifyKoaServer(container, null, { rootPath: "/api/v1" });
```

## Using a custom koa application
It is possible to pass a custom `koa.Application` instance to `InversifyKoaServer`:

```ts
let container = new Container();

let app = new Koa();
//Do stuff with app

let server = new InversifyKoaServer(container, null, null, app);
```

## Decorators

### `@controller(path, [middleware, ...])`

Registers the decorated class as a controller with a root path, and optionally registers any global middleware for this controller.

### `@httpMethod(method, path, [middleware, ...])`

Registers the decorated controller method as a request handler for a particular path and method, where the method name is a valid koa routing method.

### `@SHORTCUT(path, [middleware, ...])`

Shortcut decorators which are simply wrappers for `@httpMethod`. Right now these include `@httpGet`, `@httpPost`, `@httpPut`, `@httpPatch`, `@httpHead`, `@httpDelete`, and `@All`. For anything more obscure, use `@httpMethod` (Or make a PR :smile:).

### `@request()`
Binds a method parameter to the request object.

### `@response()`
Binds a method parameter to the response object.

### `@requestParam(name?: string)`
Binds a method parameter to request.params object or to a specific parameter if a name is passed.

### `@queryParam(name?: string)`
Binds a method parameter to request.query or to a specific query parameter if a name is passed.

### `@requestBody(name?: string)`
Binds a method parameter to request.body or to a specific body property if a name is passed. If the bodyParser middleware is not used on the koa app, this will bind the method parameter to the koa request object.

### `@requestHeaders(name?: string)`
Binds a method parameter to the request headers.

### `@context()`
Binds a method parameter to the koa context object.

### `@cookies()`
Binds a method parameter to the request cookies.

### `@next()`
Binds a method parameter to the next() function.

## License

License under the MIT License (MIT)

Copyright © 2017 [Diego Plascencia](https://github.com/diego-d5000)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
