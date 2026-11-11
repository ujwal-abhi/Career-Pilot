import type { Request, Response, NextFunction } from "express";
import multer from "multer";

// Anything no route handled. Returning JSON (not Express's default HTML page) keeps the
// API consistent and gives the client the same { success, message } shape everywhere.
export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Not found." });
}

interface HttpLikeError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

// Must be registered LAST and must take 4 arguments: that is how Express knows it is an
// error handler. It decides what the client may see. Details (stack traces, SQL, file
// paths) are logged on the server and never sent back.
export function errorHandler(err: HttpLikeError, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File is too large (max 5MB)." });
    }
    return res.status(400).json({ success: false, message: "The upload was not accepted." });
  }
  if (err.message === "ONLY_PDF_ALLOWED") {
    return res.status(400).json({ success: false, message: "Only PDF files are allowed." });
  }

  // Errors raised by the body parser. Before this they all became a generic 500.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "The request body is not valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "The request is too large." });
  }
  if (err.type === "encoding.unsupported" || err.type === "charset.unsupported") {
    return res.status(415).json({ success: false, message: "Unsupported content encoding." });
  }

  const status = err.status ?? err.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: "The request could not be processed." });
  }

  console.error(err);
  return res.status(500).json({ success: false, message: "Something went wrong." });
}