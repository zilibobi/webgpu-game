import index from "./index.html";

Bun.serve({
  routes: {
    "/": index,
    "/static/*": {
      async GET(req) {
        const path = new URL(req.url, "http://localhost:3000").pathname;
        const file = Bun.file("." + path);

        return new Response(file);
      },
    },
  },
});
