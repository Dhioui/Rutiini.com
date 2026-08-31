import type { Request, Response, NextFunction } from "express";
import { reportError } from "./errorReporting";

/**
 * Last-resort handler for anything a route did not answer itself.
 *
 * Two things this deliberately does not do.
 *
 * It does not rethrow. The original handler ended with `throw err` after it had
 * already responded; Express catches that and passes it to finalhandler, which --
 * seeing the headers are sent -- destroys the socket. Connections are pooled, so the
 * reset did not land on the request that failed but on whichever request reused that
 * socket next, turning an unrelated call into a network error. On a phone that reads
 * as "no connection" rather than as something going wrong on the page. The error is
 * logged here instead, which is what the throw was really accomplishing.
 *
 * It does not describe a 500 to the caller. `err.message` at that point is whatever
 * a driver or library produced -- a fragment of a query, a path, a connection
 * string -- and none of that belongs in a browser. Errors raised deliberately with a
 * 4xx status carry the application's own wording, so those still say what went wrong.
 */
export function createErrorHandler(log: (message: string) => void) {
  return (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;

    log(`${req.method} ${req.path} failed with ${status}: ${err?.stack || err}`);

    // Reported before the response is written, so a 500 raised after a route had
    // already started answering is still seen. Only server faults: a 403 or a 404
    // is the application working, and alerting on those would train whoever reads
    // the alerts to ignore them.
    //
    // Not awaited. Reporting must not add latency to a request that has already
    // gone wrong, and must not be able to turn a handled failure into a crash.
    if (status >= 500) {
      const user = (req as Request & { user?: { role?: string; daycareId?: number | null } }).user;
      reportError(err, {
        method: req.method,
        path: req.path,
        status,
        role: user?.role,
        daycareId: user?.daycareId,
      });
    }

    // A route that already began answering owns the response; writing more would
    // corrupt the body it had started sending.
    if (res.headersSent) return;

    // `error` is the shape the rest of the API uses and the client reads.
    res.status(status).json({
      error: status >= 500 ? "Internal Server Error" : err?.message || "Request failed",
    });
  };
}
