import {
  Injectable,
  type NestMiddleware,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class JsonOnlyMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const unsupported = this.#hasBody(request) && !this.#isJson(request);

    if (unsupported)
      throw new UnsupportedMediaTypeException(
        "The API reads application/json only",
      );

    next();
  }

  #hasBody(request: Request): boolean {
    const length = request.headers["content-length"];
    const chunked = request.headers["transfer-encoding"] !== undefined;
    return chunked || (length !== undefined && length !== "0");
  }

  #isJson(request: Request): boolean {
    const matched = request.is(["application/json", "application/*+json"]);
    return typeof matched === "string";
  }
}
