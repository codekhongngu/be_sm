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

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

type UserPayload = {
  sub: string;
  username: string;
  role: Role;
  unitId: string;
  unitName: string;
  fullName: string;
};

type Unit = {
  id: string;
  code: string;
  name: string;
  telegramGroupChatId: string | null;
  parentUnitId: string | null;
  isActive: boolean;
};

const sessions = new Map<string, UserPayload>();
const units = new Map<string, Unit>();

const seedUnits = (): void => {
  if (units.size > 0) {
    return;
  }
  units.set("system", {
    id: "system",
    code: "SYSTEM",
    name: "Khối hệ thống",
    telegramGroupChatId: null,
    parentUnitId: null,
    isActive: true,
  });
};

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};

const getCurrentUser = (request: Request): UserPayload | null => {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }
  return sessions.get(token) || null;
};

const parseJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch (error) {
    return null;
  }
};

export default {
  async fetch(request: Request): Promise<Response> {
    seedUnits();
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
      const body = await parseJson<{ username?: unknown; password?: unknown }>(request);
      if (!body) {
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

      const accessToken = `worker-${crypto.randomUUID()}`;
      sessions.set(accessToken, user);

      return json(request, {
        accessToken,
        user,
      });
    }

    if (request.method === "GET" && url.pathname === "/users/units") {
      const currentUser = getCurrentUser(request);
      if (!currentUser) {
        return json(request, { message: "Unauthorized" }, 401);
      }

      if (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
        return json(request, { message: "Forbidden" }, 403);
      }

      const allUnits = Array.from(units.values());
      if (currentUser.role === "ADMIN") {
        return json(request, allUnits);
      }
      return json(request, allUnits.filter((unit) => unit.id === currentUser.unitId));
    }

    if (request.method === "POST" && url.pathname === "/users/units") {
      const currentUser = getCurrentUser(request);
      if (!currentUser) {
        return json(request, { message: "Unauthorized" }, 401);
      }
      if (currentUser.role !== "ADMIN") {
        return json(request, { message: "Forbidden" }, 403);
      }

      const body = await parseJson<{
        code?: unknown;
        name?: unknown;
        telegramGroupChatId?: unknown;
        parentUnitId?: unknown;
        isActive?: unknown;
      }>(request);
      if (!body) {
        return json(request, { message: "Body JSON không hợp lệ" }, 400);
      }

      const code = typeof body.code === "string" ? body.code.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!code || !name) {
        return json(request, { message: "code và name là bắt buộc" }, 400);
      }

      const duplicatedCode = Array.from(units.values()).some((unit) => unit.code === code);
      if (duplicatedCode) {
        return json(request, { message: "code đã tồn tại" }, 400);
      }

      let parentUnitId: string | null = null;
      if (typeof body.parentUnitId === "string") {
        parentUnitId = body.parentUnitId;
      }
      if (body.parentUnitId === null) {
        parentUnitId = null;
      }
      if (parentUnitId && !units.has(parentUnitId)) {
        return json(request, { message: "parentUnitId không tồn tại" }, 400);
      }

      const unit: Unit = {
        id: crypto.randomUUID(),
        code,
        name,
        telegramGroupChatId:
          typeof body.telegramGroupChatId === "string" ? body.telegramGroupChatId : null,
        parentUnitId,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      };
      units.set(unit.id, unit);
      return json(request, unit, 201);
    }

    return json(request, { message: "Not Found" }, 404);
  },
};
