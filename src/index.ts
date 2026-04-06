const getCorsHeaders = (request: Request): Record<string, string> => ({
  "access-control-allow-origin": request.headers.get("origin") || "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers":
    request.headers.get("access-control-request-headers") || "content-type,authorization",
  "access-control-max-age": "86400",
  vary: "origin, access-control-request-headers",
});

const json = (request: Request, data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "referrer-policy": "no-referrer",
      ...getCorsHeaders(request),
    },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "referrer-policy": "no-referrer",
          ...getCorsHeaders(request),
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(request, { status: "ok" });
    }

    if (request.method === "GET" && url.pathname === "/auth/login") {
      return json(request, { message: "Method Not Allowed. Use POST /auth/login" }, 405);
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      let body: { username?: unknown; password?: unknown } = {};
      try {
        body = (await request.json()) as { username?: unknown; password?: unknown };
      } catch (error) {
        return json(request, { message: "Body JSON không hợp lệ" }, 400);
      }

      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (username !== "admin" || password !== "Admin@123") {
        return json(request, { message: "Sai tài khoản hoặc mật khẩu" }, 401);
      }

      const user = {
        sub: "system-admin",
        username: "admin",
        role: "ADMIN",
        unitId: "system",
        unitName: "Khối hệ thống",
        fullName: "System Admin",
      };

      return json(request, {
        accessToken: `worker-${crypto.randomUUID()}`,
        user,
      });
    }

    return json(request, { message: "Not Found" }, 404);
  },
};
