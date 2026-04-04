export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    return new Response("sm-backend worker entry is configured", { status: 200 });
  },
};
