const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      let body: { username?: unknown; password?: unknown } = {};
      try {
        body = (await request.json()) as { username?: unknown; password?: unknown };
      } catch (error) {
        return json({ message: "Body JSON không hợp lệ" }, 400);
      }

      const username = typeof body.username === "string" ? body.username : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (username !== "admin" || password !== "Admin@123") {
        return json({ message: "Sai tài khoản hoặc mật khẩu" }, 401);
      }

      const user = {
        sub: "system-admin",
        username: "admin",
        role: "ADMIN",
        unitId: "system",
        unitName: "Khối hệ thống",
        fullName: "System Admin",
      };

      return json({
        accessToken: `worker-${crypto.randomUUID()}`,
        user,
      });
    }

    return json({ message: "Not Found" }, 404);
  },
};
